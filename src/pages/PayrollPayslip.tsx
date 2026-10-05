import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";
import { PayslipScreen } from "@/components/payroll/PayslipScreen";
import { printCurrentPageA4 } from "@/lib/printA4";

/** One payslip. Printing goes through the A4 PDF path, like reports. */
export default function PayrollPayslip() {
  const { id = "" } = useParams();
  const { currentShop, role } = useShop();
  const navigate = useNavigate();
  return (
    <PayslipScreen
      id={id}
      shopName={currentShop?.name ?? ""}
      currency={currentShop?.currency ?? "PKR"}
      role={role}
      onBack={() => navigate("/payroll")}
      onPrint={() =>
        void printCurrentPageA4("payslip").catch((e) => toast.error(e instanceof Error ? e.message : "Could not open the PDF."))
      }
    />
  );
}
