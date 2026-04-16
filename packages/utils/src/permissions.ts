type CompanyType = "ORDERER" | "CONTRACTOR";
type UserRole = "REPRESENTATIVE" | "MANAGER" | "OTHER";

interface UserContext {
  role: UserRole;
  companyType: CompanyType;
}

export function canManageSites(user: UserContext): boolean {
  return user.role === "REPRESENTATIVE" || user.role === "MANAGER";
}

export function canCreateOrders(user: UserContext): boolean {
  return user.companyType === "ORDERER" && (user.role === "REPRESENTATIVE" || user.role === "MANAGER");
}

export function canApproveBilling(user: UserContext): boolean {
  return user.companyType === "ORDERER" && (user.role === "REPRESENTATIVE" || user.role === "MANAGER");
}

export function canSubmitBilling(user: UserContext): boolean {
  return user.companyType === "CONTRACTOR" && (user.role === "REPRESENTATIVE" || user.role === "MANAGER");
}

export function canManageMembers(user: UserContext): boolean {
  return user.role === "REPRESENTATIVE";
}

export function canManageCompany(user: UserContext): boolean {
  return user.role === "REPRESENTATIVE";
}

export function isRepresentative(user: UserContext): boolean {
  return user.role === "REPRESENTATIVE";
}

export function isOrderer(user: UserContext): boolean {
  return user.companyType === "ORDERER";
}

export function isContractor(user: UserContext): boolean {
  return user.companyType === "CONTRACTOR";
}
