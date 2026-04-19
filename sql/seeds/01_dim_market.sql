CREATE OR REPLACE TABLE `${GCP_PROJECT}.${SEED_DATASET}.dim_market` AS
SELECT * FROM UNNEST([
  STRUCT('ID' AS market, 'Indonesia'  AS country_name, 'Asia/Jakarta'       AS timezone, 'IDR' AS currency),
  STRUCT('TH' AS market, 'Thailand'   AS country_name, 'Asia/Bangkok'       AS timezone, 'THB' AS currency),
  STRUCT('VN' AS market, 'Vietnam'    AS country_name, 'Asia/Ho_Chi_Minh'   AS timezone, 'VND' AS currency),
  STRUCT('MY' AS market, 'Malaysia'   AS country_name, 'Asia/Kuala_Lumpur'  AS timezone, 'MYR' AS currency),
  STRUCT('SG' AS market, 'Singapore'  AS country_name, 'Asia/Singapore'     AS timezone, 'SGD' AS currency),
  STRUCT('PH' AS market, 'Philippines' AS country_name, 'Asia/Manila'       AS timezone, 'PHP' AS currency)
]);
