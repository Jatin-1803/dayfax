import 'package:equatable/equatable.dart';

class CatalogCategory extends Equatable {
  const CatalogCategory({
    required this.id,
    required this.name,
    required this.slug,
    this.parentId,
    this.iconKey,
    this.imageUrl,
    this.sortOrder = 0,
  });

  final String id;
  final String? parentId;
  final String name;
  final String slug;
  final String? iconKey;
  final String? imageUrl;
  final int sortOrder;

  factory CatalogCategory.fromJson(Map<String, dynamic> json) {
    return CatalogCategory(
      id: json['id'] as String,
      parentId: json['parentId'] as String?,
      name: json['name'] as String,
      slug: json['slug'] as String,
      iconKey: json['iconKey'] as String?,
      imageUrl: json['imageUrl'] as String?,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, slug, name];
}

class ProductVariantSummary extends Equatable {
  const ProductVariantSummary({
    required this.id,
    required this.pricePaise,
    required this.mrpPaise,
    required this.discountPercent,
    required this.quantityAvailable,
    required this.inStock,
    this.unitLabel,
  });

  final String id;
  final String? unitLabel;
  final int pricePaise;
  final int mrpPaise;
  final int discountPercent;
  final int quantityAvailable;
  final bool inStock;

  factory ProductVariantSummary.fromJson(Map<String, dynamic> json) {
    return ProductVariantSummary(
      id: json['id'] as String,
      unitLabel: json['unitLabel'] as String?,
      pricePaise: (json['pricePaise'] as num).toInt(),
      mrpPaise: (json['mrpPaise'] as num).toInt(),
      discountPercent: (json['discountPercent'] as num?)?.toInt() ?? 0,
      quantityAvailable: (json['quantityAvailable'] as num?)?.toInt() ?? 0,
      inStock: json['inStock'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [id, pricePaise];
}

class CatalogProduct extends Equatable {
  const CatalogProduct({
    required this.id,
    required this.name,
    required this.slug,
    required this.categoryName,
    required this.storeName,
    this.storeId,
    this.description,
    this.brand,
    this.imageUrl,
    this.defaultVariant,
  });

  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? brand;
  final String? imageUrl;
  final String categoryName;
  final String storeName;
  final String? storeId;
  final ProductVariantSummary? defaultVariant;

  int get pricePaise => defaultVariant?.pricePaise ?? 0;
  int? get mrpPaise => defaultVariant?.mrpPaise;
  bool get inStock => defaultVariant?.inStock ?? false;

  factory CatalogProduct.fromJson(Map<String, dynamic> json) {
    final category = json['category'] as Map<String, dynamic>? ?? const {};
    final store = json['store'] as Map<String, dynamic>? ?? const {};
    final variantJson = json['defaultVariant'] as Map<String, dynamic>?;
    return CatalogProduct(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      brand: json['brand'] as String?,
      imageUrl: json['imageUrl'] as String?,
      categoryName: category['name'] as String? ?? '',
      storeName: store['name'] as String? ?? '',
      storeId: store['id'] as String?,
      defaultVariant:
          variantJson == null ? null : ProductVariantSummary.fromJson(variantJson),
    );
  }

  @override
  List<Object?> get props => [id, slug, name, storeId];
}

class ProductVariantDetail extends Equatable {
  const ProductVariantDetail({
    required this.id,
    required this.sku,
    required this.unitLabel,
    required this.pricePaise,
    required this.mrpPaise,
    required this.discountPercent,
    required this.isDefault,
    required this.quantityAvailable,
    required this.inStock,
    this.unitValue,
    this.unitType,
  });

  final String id;
  final String sku;
  final String unitLabel;
  final double? unitValue;
  final String? unitType;
  final int pricePaise;
  final int mrpPaise;
  final int discountPercent;
  final bool isDefault;
  final int quantityAvailable;
  final bool inStock;

  factory ProductVariantDetail.fromJson(Map<String, dynamic> json) {
    return ProductVariantDetail(
      id: json['id'] as String,
      sku: json['sku'] as String,
      unitLabel: json['unitLabel'] as String,
      unitValue: (json['unitValue'] as num?)?.toDouble(),
      unitType: json['unitType'] as String?,
      pricePaise: (json['pricePaise'] as num).toInt(),
      mrpPaise: (json['mrpPaise'] as num).toInt(),
      discountPercent: (json['discountPercent'] as num?)?.toInt() ?? 0,
      isDefault: json['isDefault'] as bool? ?? false,
      quantityAvailable: (json['quantityAvailable'] as num?)?.toInt() ?? 0,
      inStock: json['inStock'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [id, sku];
}

class CatalogProductDetail extends Equatable {
  const CatalogProductDetail({
    required this.id,
    required this.name,
    required this.slug,
    required this.categoryId,
    required this.categoryName,
    required this.storeId,
    required this.variants,
    this.categorySlug,
    this.description,
    this.brand,
    this.subCategory,
    this.imageUrl,
  });

  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? brand;
  final String? subCategory;
  final String? imageUrl;
  final String categoryId;
  final String categoryName;
  final String? categorySlug;
  final String storeId;
  final List<ProductVariantDetail> variants;

  ProductVariantDetail? get defaultVariant {
    for (final variant in variants) {
      if (variant.isDefault) return variant;
    }
    return variants.isEmpty ? null : variants.first;
  }

  factory CatalogProductDetail.fromJson(Map<String, dynamic> json) {
    final category = json['category'] as Map<String, dynamic>? ?? const {};
    final variantsJson = json['variants'] as List<dynamic>? ?? const [];
    return CatalogProductDetail(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      brand: json['brand'] as String?,
      subCategory: json['subCategory'] as String?,
      imageUrl: json['imageUrl'] as String?,
      categoryId: category['id'] as String? ?? '',
      categoryName: category['name'] as String? ?? '',
      categorySlug: category['slug'] as String?,
      storeId: json['storeId'] as String? ?? '',
      variants: variantsJson
          .whereType<Map<String, dynamic>>()
          .map(ProductVariantDetail.fromJson)
          .toList(),
    );
  }

  @override
  List<Object?> get props => [id, slug];
}

class PaginationMeta extends Equatable {
  const PaginationMeta({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasNextPage,
    required this.hasPreviousPage,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final bool hasNextPage;
  final bool hasPreviousPage;

  factory PaginationMeta.fromJson(Map<String, dynamic> json) {
    return PaginationMeta(
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
      total: (json['total'] as num).toInt(),
      totalPages: (json['totalPages'] as num).toInt(),
      hasNextPage: json['hasNextPage'] as bool? ?? false,
      hasPreviousPage: json['hasPreviousPage'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [page, limit, total, totalPages];
}

class ProductPage extends Equatable {
  const ProductPage({
    required this.items,
    required this.pagination,
    this.rewrittenFor,
  });

  final List<CatalogProduct> items;
  final PaginationMeta pagination;
  final String? rewrittenFor;

  factory ProductPage.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'] as List<dynamic>? ?? const [];
    final searchMeta = json['searchMeta'] as Map<String, dynamic>?;
    return ProductPage(
      items: itemsJson
          .whereType<Map<String, dynamic>>()
          .map(CatalogProduct.fromJson)
          .toList(),
      pagination: PaginationMeta.fromJson(
        json['pagination'] as Map<String, dynamic>? ?? const {},
      ),
      rewrittenFor: searchMeta?['rewrittenFor'] as String?,
    );
  }

  @override
  List<Object?> get props => [items, pagination, rewrittenFor];
}
