import { useShop } from "@/contexts/ShopContext";

export function usePermissions() {
  const { role } = useShop();
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
  };
}
