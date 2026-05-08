# Security Specification - RIBERJO Management

## Data Invariants
1. **Identity**: Every task/report must be linked to a valid `authorId` or `creatorId` that matches a user document.
2. **Relational Integrity**: Tasks and Reports must belong to a valid Department.
3. **State Transitions**: 
   - Tasks: Status can only move between `pending`, `in_progress`, and `completed`.
   - Reports: Once `validated` or `rejected`, they cannot return to `pending` or `draft` (unless by Admin).
4. **Immutability**: `createdAt` timestamps and `authorId` fields must not change after creation.

## The "Dirty Dozen" Payloads (Denial Expected)
1. **Identity Spoofing**: Attempt to create a task with a `creatorId` that is not the current user's UID.
2. **Privilege Escalation**: A `USER` role trying to update their own role to `ADMIN` in the `users` collection.
3. **Ghost Fields**: Adding a `verified: true` field to a user profile to bypass system checks.
4. **Relational Orphan**: Creating a report for a non-existent department ID.
5. **PII Breach**: A regular user trying to `get` the profile of another user they don't work with (if restricted).
6. **Malicious ID**: Using a 2KB string as a `taskId` to cause resource exhaustion.
7. **Negative Inventory**: Updating an asset quantity to `-100`.
8. **Bypassing Workflow**: A `USER` setting a report status to `validated` directly.
9. **Timeline Fraud**: Setting a `createdAt` date in the future.
10. **Shadow Tasking**: Assigning a task to a user who doesn't exist.
11. **Cross-Dept Interference**: A worker from 'FIN' trying to update a task in 'RHU'.
12. **Protocol Poisoning**: A `USER` attempting to overwrite the department operating protocols.

## Test Strategy
All writes must be validated against `isValid[Entity]` helpers.
Update operations must use `affectedKeys().hasOnly()` gates.
PII fields (phone, address) must be restricted to the owner or ADMIN.
