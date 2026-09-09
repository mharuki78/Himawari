export const CLAIM_NOTIFICATION_RETRIES = `WITH candidates AS (SELECT n.id FROM order_notifications n
    WHERE n.status IN ('failed','pending') AND n.payload IS NOT NULL AND n.attempts<5 AND n.created_at>now()-interval '23 hours'
    AND (n.lease_until IS NULL OR n.lease_until<now())
    AND EXISTS(SELECT 1 FROM orders o WHERE o.order_number=n.order_number AND o.revision=n.revision)
    ORDER BY n.created_at LIMIT 3 FOR UPDATE SKIP LOCKED)
    UPDATE order_notifications n SET status='pending',attempts=n.attempts+1,lease_until=now()+interval '2 minutes'
    FROM candidates c WHERE n.id=c.id RETURNING n.id,n.payload`;
