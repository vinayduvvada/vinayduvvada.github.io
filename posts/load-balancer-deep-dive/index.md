# Load Balancers Deep Dive: L4 vs L7, Algorithms, and Modern ADC

Load balancers are among the most critical — and least glamorous — components in any distributed system. They're the invisible traffic directors that make high availability, horizontal scaling, and zero-downtime deploys possible. I spent years building automation for ServiceNow's Application Delivery Controller (ADC) migration, so here's a thorough breakdown of how modern load balancing works.

## OSI Layer: L4 vs L7

### L4 Load Balancing (Transport Layer)

L4 load balancers operate on TCP/UDP packets. They route traffic based on IP address and port without inspecting the payload.

**How it works**:
- Client opens a TCP connection to the load balancer VIP (Virtual IP).
- LB chooses a backend server and proxies the TCP stream.
- The backend server terminates the TCP connection (in NAT mode) or the client connects directly (in Direct Server Return mode).

**Characteristics**:
- Very fast — no content inspection.
- Protocol agnostic — works for any TCP/UDP traffic.
- Cannot make routing decisions based on HTTP headers, paths, or cookies.
- Lower latency, higher throughput.

**Use when**: High-throughput, low-latency protocols — database connections, gaming, raw TCP microservices.

### L7 Load Balancing (Application Layer)

L7 load balancers inspect the full HTTP request before routing. They terminate the client connection and make a new connection to the backend.

**How it works**:
1. Client → LB: TCP connection established, HTTP request received.
2. LB inspects: HTTP method, path, headers, cookies, body.
3. LB routes to backend based on content rules.
4. LB → Backend: New TCP connection; backend responds to LB; LB responds to client.

**Capabilities**:
- Path-based routing: `/api/*` → API servers, `/static/*` → CDN/object storage.
- Header-based routing: `X-Tenant: premium` → premium tier backends.
- SSL termination: decrypt once at the LB, plain HTTP to backends.
- Cookie-based session affinity (sticky sessions).
- Request/response rewriting.
- Health checks at the HTTP level (check `/health` endpoint, not just TCP port).
- gRPC-aware routing.

**Use when**: HTTP/HTTPS traffic, microservices, API gateways, content-based routing.

## Load Balancing Algorithms

### Round Robin
Requests distributed sequentially: server 1, 2, 3, 1, 2, 3…

- Simple, stateless.
- Problem: doesn't account for server capacity or current load.
- **Weighted Round Robin**: Assign weights — server with weight 3 gets 3x more requests.

### Least Connections
Route to the backend with the fewest active connections.

- Better for variable request duration.
- **Weighted Least Connections**: Factor in server capacity.

### Least Response Time
Route to the backend with the lowest average response time AND fewest active connections.

- Combines load and performance signals.
- Requires tracking response times — slightly more complex.

### IP Hash (Session Affinity)
Hash the client IP to consistently route the same client to the same backend.

- Useful for stateful apps that haven't externalized session state.
- Problem: hash skew if a large % of traffic comes from a NAT gateway IP.

### Random with Two Choices (Power of Two)
Randomly pick two backends, route to the one with fewer connections.

- Approximates least connections with O(1) overhead.
- Used by Nginx, Envoy for its scalability.

### Consistent Hashing
Used in distributed caches (Memcached, Redis Cluster). Backends are arranged on a hash ring; requests hash to the nearest backend. Adding/removing a node only rehashes ~1/N keys.

## Health Checks

A load balancer is only as good as its health-checking. Three types:

1. **TCP health check**: Can I open a TCP connection to port X?
2. **HTTP health check**: Does `GET /health` return 200?
3. **Application-level**: Does `GET /health` return 200 with a valid body (`{"status":"ok"}`)?

**Active vs Passive**:
- **Active**: LB probes backends on a schedule (every 5s).
- **Passive**: LB monitors live traffic; marks a backend unhealthy after N consecutive failures.

**Health check thresholds**:
- `healthy_threshold: 2` — 2 consecutive successes to mark healthy.
- `unhealthy_threshold: 3` — 3 consecutive failures to mark unhealthy.
- Prevents flapping from transient errors.

## SSL Termination & mTLS

**SSL Termination at LB**:
- Client-LB: HTTPS (TLS).
- LB-Backend: HTTP or HTTPS (re-encryption).
- Benefits: Centralized certificate management, backends don't need TLS stacks, LB can inspect content.

**Passthrough (SSL Bridging)**:
- LB forwards encrypted traffic unchanged; backend terminates TLS.
- Required for end-to-end encryption compliance.
- LB can't do L7 routing (can't see headers).

**mTLS (Mutual TLS)**:
- Both client and server present certificates.
- Required in zero-trust network environments.
- Common in service mesh (Istio, Linkerd) where sidecar proxies handle mTLS transparently.

## F5 Hardware to Software-Defined ADC

This is close to home. At ServiceNow, I led automation for migrating 95%+ of customer instances from legacy F5 hardware load balancers to an in-house software Application Delivery Controller (ADC).

**F5 BIG-IP (hardware)**:
- Purpose-built ASICs for line-rate SSL offload and NAT.
- Rich feature set (iRules for scripted routing, ASM for WAF).
- Expensive, long procurement cycles, limited programmability.
- Configuration via proprietary tmsh CLI or GUI.

**Software ADC**:
- Runs on commodity x86 hardware or VMs.
- Programmatically configured via API.
- Scales horizontally (add more ADC nodes).
- Integration with CI/CD and infrastructure-as-code.
- Enables automation that F5's traditional model made difficult.

**Migration challenges**:
- Feature parity: every F5 iRule had to map to ADC configuration.
- Zero-downtime: we used traffic shifting — 10% → 50% → 100% over days.
- Validation: automated health checks pre/post each shift.
- Rollback: automated rollback if error rate crossed threshold within 5 minutes of a shift.

## Modern Architecture: Service Mesh

In Kubernetes environments, a **service mesh** (Istio, Linkerd, Consul Connect) replaces traditional load balancers for east-west (service-to-service) traffic:

- Each pod gets a sidecar proxy (Envoy).
- Sidecar handles load balancing, mTLS, retries, circuit breaking, and observability.
- Control plane pushes routing configuration to all sidecars.

This moves L7 load balancing to the application layer, enabling per-route policies without touching the infrastructure layer.

## Key Takeaways

- **L4** for raw throughput and protocol agnosticism; **L7** for HTTP-aware routing and SSL termination.
- **Least connections** or **power of two choices** over round robin for variable workloads.
- **Active health checks with thresholds** prevent traffic to unhealthy backends.
- **Software ADCs** enable automation and programmatic control that hardware boxes never could.
- **Service mesh** extends L7 load balancing into the cluster for service-to-service traffic.

Understanding load balancers deeply changes how you design for high availability, zero-downtime deployments, and traffic management at scale.
