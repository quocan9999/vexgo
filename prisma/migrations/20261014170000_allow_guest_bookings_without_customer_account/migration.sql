-- Keep guest contact data on DonGiaoDich without linking it to a customer account.
ALTER TABLE `DonGiaoDich`
  MODIFY `khachHangId` INT NULL;
