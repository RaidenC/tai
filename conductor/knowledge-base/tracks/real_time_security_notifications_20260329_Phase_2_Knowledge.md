# Track real_time_security_notifications_20260329 Phase 2 Knowledge

## The Enterprise Challenge
High-volume audit logs in a Fintech environment can grow to billions of rows. Standard indexing becomes sluggish, and maintenance (like archiving old data) becomes a nightmare. We need a storage strategy that scales horizontally without sacrificing lookup speed for specific security events.

## Knowledge Hierarchy

### Junior Level (The "What")
- **Table Partitioning:** Splitting one large table into smaller, more manageable pieces (partitions) based on a key (like a Date).
- **Composite Primary Keys:** In partitioned tables, the partition key *must* be part of the Primary Key. We used `(Id, Timestamp)`.
- **Indices:** We added indices to make searching faster, such as finding all logs for a specific user.

### Mid Level (The "How")
- **Declarative Partitioning in Postgres:** We used `PARTITION BY RANGE ("Timestamp")` to automatically route data into the correct date-based bucket.
- **Default Partition:** We created `AuditLogs_Default` to handle any data that doesn't fit into a specific range, preventing insert failures.
- **EF Core Migration Customization:** Since standard EF Core doesn't fully automate Postgres partitioning yet, we used `migrationBuilder.Sql()` to perform a "Rename-Create-Migrate-Drop" pattern.

### Senior/Principal Level (The "Why")
- **Performance at Scale:** Partitioning allows for **Partition Pruning**. The database engine can skip searching entire years of data if it knows the query only targets last week, massively reducing I/O.
- **Maintenance Operations:** Dropping an old month of data becomes a metadata-only operation (`DROP TABLE partition_name`) instead of a massive, transaction-log-heavy `DELETE FROM table WHERE date < ...`.
- **Global Indexing on Partitioned Tables:** We balanced the need for local partition performance with the **Claim Check Pattern** requirement by adding a global (non-unique) index on `Id`. This ensures that when the SignalR hub sends an ID, we can find the details instantly across all partitions.
- **Zero-Trust Storage:** The composite index `(TenantId, UserId, Timestamp)` is specifically designed to support our multi-tenant global query filters, ensuring that index seeks are always scoped to the tenant first.

## Deep-Dive Mechanics
The migration used explicit column mapping in the `INSERT INTO ... SELECT ...` statement. This is a critical best practice because `SELECT *` is brittle during schema migrations where column orders might change between the old and new table definitions.

## Interview Talking Points (Tiered)
- **Junior/Mid:** "I implemented date-based table partitioning for the audit log system to ensure query performance as the dataset grows. I also customized EF Core migrations with raw SQL to handle the Postgres-specific partitioning syntax."
- **Senior/Lead:** "I designed a high-performance storage strategy for append-only audit logs using PostgreSQL declarative partitioning. By using a composite primary key and strategic indexing, I enabled partition pruning for dashboard queries while maintaining sub-millisecond 'Claim Check' lookups via a global index on the unique event ID."

## March 2026 Market Context
In 2026, **PostgreSQL Declarative Partitioning** is the standard for high-volume Fintech data. Combined with **Zoneless Angular** (which we'll see in Phase 5), it ensures the system remains responsive even under heavy security event bursts.
