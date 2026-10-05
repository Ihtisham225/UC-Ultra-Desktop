import { useNavigate, useSearchParams } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";
import { PayrollScreen } from "@/components/payroll/PayrollScreen";

/**
 * Payroll — the web app's screen (`src/components/payroll/`, copied verbatim)
 * over RPC. The shown day is kept in `?on=` through the router: the app runs
 * on a HashRouter, so history.replaceState would drop the hash.
 */
export default function Payroll() {
  const { currentShop, role } = useShop();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  return (
    <PayrollScreen
      currency={currentShop?.currency ?? "PKR"}
      role={role}
      initialOn={params.get("on")}
      onOnChange={(on) => setParams({ on }, { replace: true })}
      onOpenPayslip={(id) => navigate(`/payroll/payslips/${id}`)}
      onOpenEmployee={(id) => navigate(`/payroll/employees/${id}`)}
    />
  );
}
