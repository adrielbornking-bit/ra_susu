ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_bounds" CHECK (amount >= 2200 AND amount <= 11000);
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_positive_number" CHECK ("slotNumber" > 0);
CREATE UNIQUE INDEX "User_single_super_admin" ON "User" (role) WHERE role = 'SUPER_ADMIN';
