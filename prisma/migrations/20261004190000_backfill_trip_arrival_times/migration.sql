UPDATE `ChuyenXe` AS `c`
INNER JOIN `TuyenXe` AS `t`
  ON `t`.`tuyenXeId` = `c`.`tuyenXeId`
  AND `t`.`nhaXeId` = `c`.`nhaXeId`
SET `c`.`gioDen` = ADDTIME(
  `c`.`gioKhoiHanh`,
  SEC_TO_TIME(`t`.`thoiGianChayPhut` * 60)
)
WHERE `c`.`gioDen` IS NULL
  AND `t`.`thoiGianChayPhut` IS NOT NULL;
