// Per-shop module permissions definition (mirrors UHMS structure).
export const MODULES = [
  "pos","products","sales","customers","suppliers","purchases","returns","expenses","debts","analytics","staff","settings",
] as const;
export const ACTIONS = ["view","create","edit","delete"] as const;
export type Module = typeof MODULES[number];
export type Action = typeof ACTIONS[number];

export const MODULE_LABEL: Record<Module, string> = {
  pos: "POS",
  products: "Products",
  sales: "Sales",
  customers: "Customers",
  suppliers: "Suppliers",
  purchases: "Purchases",
  returns: "Returns",
  expenses: "Expenses",
  debts: "Debts",
  analytics: "Analytics",
  staff: "Staff & Roles",
  settings: "Settings",
};

export const ACTION_LABEL: Record<Action, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

export const ACTION_HINT: Record<Action, string> = {
  view: "Open the page and see records",
  create: "Add new records",
  edit: "Modify existing records",
  delete: "Remove records",
};

export const moduleSupportsAction = (_m: Module, _a: Action): boolean => true;
