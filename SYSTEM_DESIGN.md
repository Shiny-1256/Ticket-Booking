System Design : Ticket Booking Platform

1. Overview & Architecture

The Ticket Booking System is designed to handle high-demand cinema and concert event ticketing where seat allocation must be instantaneous, strictly fair, and resistant to double-booking under high concurrency. The system comprises a Node.js/Express REST & WebSocket backend, an SQLite database using Write-Ahead Logging (WAL) mode for fast concurrent operations, and a modern React visual interface with Socket.IO real-time status synchronization.

---

2. Seat Hold & TTL Mechanism

Hold Acquisition
When a customer selects seats on the interactive map grid, the frontend dispatches a hold request. The system calculates a configurable hold expiration timestamp ($T_{\text{expire}} = T_{\text{current}} + \text{TTL}_{\text{minutes}}$, defaulting to 10 minutes) and updates the seat record state to `HELD` bound to `held_by_user_id`.

Expiry & Auto-Release Engine
- Background Worker: A lightweight background job (`ttlWorker.js`) polls every 5 seconds for expired holds where $\text{held\_until} \le \text{NOW}()$ and status is `HELD`.
- Abandonment: If a user navigates away or abandons checkout, an explicit release endpoint immediately sets seat status back to `AVAILABLE`.
- Real-Time Synchronization**: Any release automatically triggers a Socket.IO event (`seatStatusUpdated`) to all connected browser clients viewing that event room, immediately updating their visual seat maps without requiring a page refresh.

---

3. Concurrency Protection & Race Prevention

 Problem Statement
When high-demand events go live, thousands of users attempt to select the same high-tier seats (e.g. VIP A1) within milliseconds. A naive read-then-write pattern leads to race conditions and double-booking.

Solution: Atomic Database Isolation
1. Immediate Transaction Locks: Read and update operations are executed inside an SQLite `BEGIN IMMEDIATE` transaction.
2. Atomic Conditioned Updates:
   ```sql
   UPDATE show_seats
   SET status = 'HELD', held_by_user_id = ?, held_until = ?, hold_id = ?
   WHERE id = ? AND (status = 'AVAILABLE' OR (status = 'HELD' AND held_by_user_id = ?));
   ```
3. Optimistic Guard: If affected rows equal 0, the operation instantly fails. The server returns HTTP status `409 Conflict` with message *"Seat no longer available"*.
4. Result: Only exactly one user request succeeds; all concurrent attempts are safely rejected without corrupted state.

---

4. Automated Waitlist Allocation Engine

Waitlist Queueing
When an entire event or seat category (e.g. VIP) sells out, customers can join a FIFO waitlist queue. Entries are assigned a status of `WAITING` and ordered by `created_at` timestamp.

Cancellation Trigger Flow
1. Trigger: When a confirmed booking is cancelled, or a held seat expires/abandoned in a sold-out category, the cancellation handler invokes `processNextWaitlistOffer()`.
2. Offer Generation:
   - The system retrieves the top `WAITING` user for that show & category.
   - It transitions the seat to `OFFERED` status, reserved exclusively for that user.
   - A unique `offer_token` is generated with a strict time-limited offer TTL (e.g. 5 minutes).
3. Notification: An automated email notification containing an offer claim link is generated with an inline QR preview.

---

5. Time-Limited Offer Expiration & Advancement

Offer Lifecycle
- Claimed: If the customer claims the offer before `expires_at`, seat status transitions to `BOOKED`, generating a confirmed QR ticket.
- Expired: If the timer expires without completion:
  1. The background worker updates `waitlist_offers` status to `EXPIRED`.
  2. The waitlist entry is marked `EXPIRED`.
  3. The system automatically re-invokes `processNextWaitlistOffer()` to pass the seat offer to the *next customer in queue*.
  4. If no waitlisted customers remain, the seat state returns to `AVAILABLE` for public booking.

This automated lifecycle eliminates wasted inventory from cancellations while giving waitlisted users fair, time-bounded opportunities.
