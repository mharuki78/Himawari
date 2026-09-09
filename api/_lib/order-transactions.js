export const CONFIRM_ORDER_SQL = `WITH limits AS (SELECT * FROM jsonb_to_recordset($8::jsonb) AS x("productId" text, "optionId" text, "baseStock" integer)),
       used AS (SELECT product_id, option_id, SUM(quantity)::integer AS quantity FROM inventory_reservations WHERE active=true AND order_id<>$9 GROUP BY product_id, option_id),
       stock_ok AS (SELECT NOT EXISTS (
         SELECT 1 FROM order_items oi JOIN limits l ON l."productId"=oi.product_id AND l."optionId"=COALESCE(oi.option_id,'')
         LEFT JOIN used u ON u.product_id=oi.product_id AND u.option_id=COALESCE(oi.option_id,'')
         WHERE oi.order_id=$9 AND l."baseStock" IS NOT NULL AND oi.quantity+COALESCE(u.quantity,0)>l."baseStock"
       ) AS ok),
       updated AS (UPDATE orders SET status=$1, tracking_number=$2, revision=revision+1, updated_at=now() WHERE order_number=$3 AND revision=$4 AND status=$5 AND (SELECT ok FROM stock_ok) RETURNING id),
       reserved AS (INSERT INTO inventory_reservations (order_item_id,order_id,product_id,option_id,quantity,active)
         SELECT oi.id,oi.order_id,oi.product_id,COALESCE(oi.option_id,''),oi.quantity,true FROM order_items oi JOIN updated u ON u.id=oi.order_id
         ON CONFLICT (order_item_id) DO UPDATE SET active=true,quantity=EXCLUDED.quantity,updated_at=now() RETURNING order_id),
       event AS (INSERT INTO order_events (id,order_id,actor,from_status,to_status,note) SELECT $6,id,'admin',$5,$1,$7 FROM updated RETURNING order_id)
       SELECT order_id FROM event`;

export const CANCEL_ORDER_SQL = `WITH updated AS (UPDATE orders SET status=$1,tracking_number=$2,revision=revision+1,updated_at=now() WHERE order_number=$3 AND revision=$4 AND status=$5 RETURNING id),
       coupons_released AS (UPDATE coupon_claims c SET used_at=NULL,order_id=NULL FROM updated u WHERE c.order_id=u.id RETURNING c.id),
       released AS (UPDATE inventory_reservations r SET active=false,updated_at=now() FROM updated u WHERE r.order_id=u.id AND r.active=true RETURNING r.order_id),
       event AS (INSERT INTO order_events (id,order_id,actor,from_status,to_status,note) SELECT $6,id,'admin',$5,$1,$7 FROM updated RETURNING order_id)
       SELECT order_id FROM event`;
