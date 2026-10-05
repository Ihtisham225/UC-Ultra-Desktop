import { useNavigate, useParams } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";
import { EmployeeHistoryScreen } from "@/components/payroll/EmployeeHistoryScreen";

export default function PayrollEmployee() {
  const { id = "" } = useParams();
  const { currentShop } = useShop();
  const navigate = useNavigate();
  return (
    <EmployeeHistoryScreen
      id={id}
      currency={currentShop?.currency ?? "PKR"}
      onBack={() => navigate("/payroll")}
      onOpenPayslip={(slip) => navigate(`/payroll/payslips/${slip}`)}
    />
  );
}
