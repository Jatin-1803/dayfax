enum AppRole {
  customer,
  deliveryPartner,
}

extension AppRoleX on AppRole {
  bool get isCustomer => this == AppRole.customer;
  bool get isDeliveryPartner => this == AppRole.deliveryPartner;
}
