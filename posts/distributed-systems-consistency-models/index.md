# Consistency Models in Distributed Systems: CAP, PACELC, and Beyond

One of the hardest problems in distributed systems is deciding what guarantees to make about data consistency. Get it wrong and you either sacrifice correctness or availability. Understanding the spectrum of consistency models — and the tradeoffs each entails — is foundational to building reliable systems.

## The CAP Theorem

Eric Brewer's CAP theorem states that a distributed system can guarantee at most two of three properties simultaneously:

- **Consistency (C)**: Every read receives the most recent write or an error.
- **Availability (A)**: Every request receives a response (not an error), even if it's stale.
- **Partition Tolerance (P)**: The system continues operating even if network messages are dropped between nodes.

Since network partitions are a fact of distributed life, you're always choosing between **CP** (consistent but potentially unavailable during partitions) and **AP** (available but potentially stale during partitions).

## PACELC: A More Complete Model

CAP only describes behavior during partitions. PACELC extends this to the normal operating case:

> **P**: During a Partition, choose **A** (Availability) or **C** (Consistency)  
> **E**: Else (no partition), choose **L** (Latency) or **C** (Consistency)

Examples:
- **DynamoDB**: PA/EL — available during partitions, low latency over consistency in normal operation.
- **HBase**: PC/EC — consistent during and without partitions (Zookeeper-based coordination).
- **Cassandra**: PA/EL by default, tunable to PC/EC per operation.

## The Consistency Spectrum

Consistency is not binary. It exists on a spectrum:

### Strong Consistency (Linearizability)
Every read sees the result of the most recent write. Operations appear instantaneous and globally ordered.

- **How**: Requires coordination — consensus protocols (Paxos, Raft), distributed locks.
- **Cost**: Higher latency, lower availability.
- **Use when**: Financial transactions, inventory management, distributed locking.

### Sequential Consistency
All operations appear to execute in some global sequential order. Each process's operations appear in-order but the global order is not necessarily real-time.

### Causal Consistency
If operation A causally influences operation B, all nodes see A before B. Unrelated operations may be seen in any order.

- **Use when**: Social feeds, comment threads — "you always see replies after their parent post."

### Eventual Consistency
Given no new updates, all nodes will eventually converge to the same value. No guarantees on *when*.

- **How**: CRDTs (Conflict-free Replicated Data Types), last-write-wins, vector clocks.
- **Cost**: Reads may be stale; conflict resolution logic needed.
- **Use when**: DNS propagation, shopping cart items, user preferences.

### Read-Your-Writes
A client always sees its own writes, even if other clients may see stale data.

- **Practical**: Session consistency — route a user's reads to the replica that has their latest write.

## Real-World Database Choices

| Database | Consistency Model | CAP Class |
|----------|------------------|-----------|
| PostgreSQL (single node) | Strong | CP |
| MySQL with GTID replication | Read-your-writes | CP leaning |
| Cassandra (default) | Eventual | AP |
| DynamoDB | Eventual (optional strong) | AP |
| MongoDB | Eventual (configurable) | CP/AP tunable |
| CockroachDB | Serializable | CP |
| Redis Cluster | Eventual (during failover) | AP |

## Practical Patterns

### Read Quorums
In systems like Cassandra, you tune `R` (reads) and `W` (writes) relative to `N` (replicas):
- Strong: `R + W > N` (quorum reads and writes)
- Eventual: `R = 1, W = 1` (fast but stale reads possible)

### Version Vectors & CRDTs
For systems that allow concurrent writes (like shopping carts), CRDTs enable conflict-free merging:
- **G-Counter**: Grow-only counter. Merge = max per node.
- **OR-Set**: Allow concurrent add/remove; last-write-wins with unique tags.
- **LWW-Register**: Last-write-wins register with timestamps.

### Read Repair & Anti-Entropy
Eventual consistent systems repair diverged replicas:
- **Read repair**: When a read detects stale replicas, it updates them inline.
- **Anti-entropy**: Background process continuously reconciles replicas using Merkle trees.

## Lessons from Production

Working on PostgreSQL (RaptorDB) upgrades for ServiceNow, I saw firsthand the tradeoffs: during a near-zero-downtime upgrade, replication lag between primary and standbys creates a window of potential stale reads. The solution is to:
1. Wait for replication lag to drop below a threshold before promoting.
2. Use read-your-writes session routing for critical operations.
3. Perform post-upgrade validation to confirm consistency.

For distributed key stores (Cassandra, DynamoDB), the pattern of "accept writes everywhere, reconcile later" requires careful conflict resolution strategy upfront — not an afterthought.

## Conclusion

There's no universally correct consistency model. Choose based on:
- **Business domain tolerance for stale data** — can users see a 5-second-old shopping cart?
- **Write/read patterns** — mostly reads? Optimize for availability.
- **Failure mode cost** — is a stale read worse than a timeout?

The best distributed systems engineers don't pick the strongest consistency model by default — they pick the *weakest* model their domain can tolerate, and build the right conflict resolution logic around it.
