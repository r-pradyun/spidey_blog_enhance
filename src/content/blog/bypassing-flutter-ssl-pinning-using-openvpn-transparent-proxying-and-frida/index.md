---
title: Bypassing Flutter SSL Pinning Using OpenVPN, Transparent Proxying, and Frida
date: "2025-12-15"
summary: ""
draft: false
tags: ["android"]
---

Flutter applications increasingly rely on **native networking stacks (BoringSSL)** and raw sockets, making traditional proxy-based interception ineffective. In hardened apps, even popular Flutter SSL pinning bypass scripts fail because the application:

- Ignores system proxy settings
    
- Uses native socket connections instead of Java APIs
    
- Performs certificate verification inside Flutter’s engine
    

This post documents a **reliable, layered methodology** to intercept Flutter HTTPS traffic using:

- **OpenVPN-based traffic routing**
    
- **Transparent proxying with Burp Suite**
    
- **Runtime socket redirection and TLS bypass using Frida**
    

The approach works even when proxy settings, Network Security Config, and basic pinning bypasses are ignored.

---

## High-Level Architecture

```
Flutter App
   ↓
OpenVPN Tunnel (tun0)
   ↓
Linux VPN Gateway (iptables NAT + redirect)
   ↓
Burp Suite (Invisible Proxy)
```

Frida instrumentation complements this by:

- Forcing socket connections to Burp
    
- Bypassing Flutter / BoringSSL certificate verification
    

---

## Step 1: Setting Up OpenVPN Server (Linux)

The VPN server acts as a **traffic choke point**, ensuring all Android traffic passes through a controllable gateway.

### Install OpenVPN and Easy-RSA

```bash
sudo apt update
sudo apt install -y openvpn easy-rsa
```

---

### Create PKI and Certificates

```bash
make-cadir ~/openvpn-ca
cd ~/openvpn-ca

./easyrsa init-pki
./easyrsa build-ca
```

Generate server and client certificates:

```bash
./easyrsa gen-req server nopass
./easyrsa sign-req server server

./easyrsa gen-req android nopass
./easyrsa sign-req client android
```

Generate Diffie-Hellman and TLS auth key:

```bash
./easyrsa gen-dh
openvpn --genkey --secret ta.key
```

---

### OpenVPN Server Configuration

Create `/etc/openvpn/server.conf`:

```conf
port 4443
proto tcp
dev tun

ca ca.crt
cert server.crt
key server.key
dh dh.pem
tls-auth ta.key 0

topology subnet
server 10.8.0.0 255.255.255.0

push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 8.8.8.8"

keepalive 10 120
cipher AES-256-GCM
auth SHA256

user nobody
group nogroup

persist-key
persist-tun
verb 3
```

Start OpenVPN:

```bash
sudo systemctl enable openvpn@server
sudo systemctl start openvpn@server
```

---

### Enable IP Forwarding (Critical)

```bash
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee /etc/sysctl.d/99-ipforward.conf
```

---

### NAT and Forwarding Rules

Without this, the VPN will connect but Android will have **no internet**.

```bash
iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o eth0 -j MASQUERADE
iptables -A FORWARD -i tun0 -o eth0 -j ACCEPT
iptables -A FORWARD -i eth0 -o tun0 -j ACCEPT
```

---

## Step 2: Android OpenVPN Client

Create `android.ovpn` and import it using **OpenVPN for Android**:

```conf
client
dev tun
proto tcp
remote <VPN_SERVER_IP> 4443

nobind
persist-key
persist-tun

cipher AES-256-GCM
auth SHA256
key-direction 1
remote-cert-tls server

<ca>
# ca.crt
</ca>

<cert>
# android.crt
</cert>

<key>
# android.key
</key>

<tls-auth>
# ta.key
</tls-auth>
```

Once connected, Android traffic is routed through the VPN gateway.

---

## Step 3: Transparent Proxying to Burp

Burp must be configured as an **invisible proxy** because Flutter does not respect proxy settings.

### Burp Configuration

- Bind to all interfaces
    
- Listen on port `8080`
    
- Enable invisible proxy
    
- Enable HTTP/2 support
    

---

### Redirect HTTPS Traffic to Burp

Run on the **OpenVPN server**:

```bash
iptables -t nat -A PREROUTING -i tun0 -p tcp --dport 443 -j REDIRECT --to-port 8080
iptables -t nat -A PREROUTING -i tun0 -p tcp --dport 80  -j REDIRECT --to-port 8080
```

At this stage:

- Traffic reaches Burp
    
- TLS fails due to pinning (expected)
    

---

## Step 4: Frida-Based Flutter TLS Bypass

Flutter embeds **BoringSSL** inside `libflutter.so`. TLS verification happens in native code and is invisible to Java hooks.

Instead of reinventing this logic, we use the proven script:

  [frida-flutterproxy](https://github.com/hackcatml/frida-flutterproxy)

This script provides:

- Dynamic ELF parsing of `libflutter.so`
    
- Memory scanning for Flutter/BoringSSL symbols
    
- TLS verification bypass:
    
    - `ssl_crypto_x509_session_verify_cert_chain` (Android)
        
    - `ssl_verify_peer_cert` (iOS)
        
- **Socket-level redirection via `GetSockAddr`**

---

## Step 5: Socket-Level Redirection (Decisive Step)

Many Flutter apps still:

- Use raw sockets
    
- Resolve IPs internally
    
- Bypass proxy routing entirely
    

To defeat this, the script hooks Flutter’s internal socket creation path and **rewrites the destination sockaddr** before the connection occurs.

### Core Concept

```js
ptr(sockaddr).add(0x2).writeU16(byteFlip(BURP_PROXY_PORT));
ptr(sockaddr).add(0x4).writeByteArray(convertIpToByteArray(BURP_PROXY_IP));
```

This forces **all outbound Flutter connections** to go through Burp regardless of hostname, IP, or protocol.

---
## Final Outcome

By combining **VPN-based traffic control**, **transparent iptables redirection**, and **Frida-based Flutter instrumentation**, full HTTPS interception was achieved without modifying the APK or affecting app stability.

This setup forces all Flutter traffic through Burp, bypasses native BoringSSL certificate verification, and redirects socket connections at runtime working even when proxy settings and standard pinning bypasses fail.

### When to Use This

Use this approach when Flutter apps:

- Ignore system proxy settings
    
- Implement SSL pinning in native code
    
- Bypass Network Security Config
    
- Require full request/response visibility
    

Once routing, sockets, and trust decisions are controlled, **Flutter SSL pinning becomes an implementation detail, not a blocker**.
