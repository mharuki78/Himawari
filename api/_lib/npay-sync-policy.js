// Only reviewed schedules are accepted. A different cadence also needs matching
// capacity/cutover proof; an arbitrary age setting cannot disable freshness.
export function npaySyncPolicy(env=process.env) {
  const cadence=env.NPAY_SYNC_CADENCE??'5m';
  if(cadence==='4h')return{cadence,maxAgeMs:5*3600_000,maxRequests:10};
  if(cadence==='5m')return{cadence,maxAgeMs:600_000,maxRequests:20};
  return null;
}
