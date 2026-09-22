import { useShop } from "@/contexts/ShopContext";

export function usePermissions() {
  const { role, hasPerm } = useShop();
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isCashier = role === "cashier";
  const ownerOrManager = isOwner || isManager;

  return {
    role,
    isOwner,
    isManager,
    isCashier,
    canManageProducts: ownerOrManager,
    canManagePurchases: ownerOrManager,
    canManageExpenses: ownerOrManager,
    canManageSuppliers: ownerOrManager,
    canManageStaff: isOwner,
    canEditShop: isOwner,
    canViewExpensesReport: ownerOrManager,
    /**
     * Seeing what things cost and what the shop makes — the dashboard's gross
     * profit tile and the cost on POS cards. The owner and a manager always
     * may; anyone else needs "Profit & cost" on their staff role, which the
     * default Cashier does not have.
     */
    canSeeProfit: ownerOrManager || hasPerm("profit", "view"),
  };
}
