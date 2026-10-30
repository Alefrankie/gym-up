-- Routines named after a weekday ("Monday", "Lunes, pecho"…) get that day as their planned weekday.
UPDATE routine_days SET weekday = CASE
  WHEN lower(day_name) LIKE 'sunday%' OR lower(day_name) LIKE 'domingo%' THEN 0
  WHEN lower(day_name) LIKE 'monday%' OR lower(day_name) LIKE 'lunes%' THEN 1
  WHEN lower(day_name) LIKE 'tuesday%' OR lower(day_name) LIKE 'martes%' THEN 2
  WHEN lower(day_name) LIKE 'wednesday%' OR lower(day_name) LIKE 'mi_rcoles%' THEN 3
  WHEN lower(day_name) LIKE 'thursday%' OR lower(day_name) LIKE 'jueves%' THEN 4
  WHEN lower(day_name) LIKE 'friday%' OR lower(day_name) LIKE 'viernes%' THEN 5
  WHEN lower(day_name) LIKE 'saturday%' OR lower(day_name) LIKE 's_bado%' THEN 6
  ELSE weekday END
WHERE weekday IS NULL;
