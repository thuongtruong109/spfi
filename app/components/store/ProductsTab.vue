<template>
  <div class="products-tab">
    <div class="products-manager">
      <!-- Loading state -->
      <div v-if="productStore.isLoading && !products.length" id="loading">
        <LoaderCircle class="loading-icon" aria-hidden="true" />
        {{ t("product.loadingProducts") }}
      </div>
      <div v-else-if="productStore.error" id="loading" class="error-state" role="alert">
        {{ productStore.error }}
      </div>

      <!-- ════════════════════════════════════════ SCREEN: LIST -->
      <div v-else>
        <div class="page-meta-header">
          <div class="page-meta-left">
            <BaseButton
              class="product-filter-header-button"
              size="medium"
              type="button"
              :aria-expanded="showProductFilters"
              aria-controls="product-filter-panel"
              @click="showProductFilters = !showProductFilters"
            >
              <template #icon><SlidersHorizontal aria-hidden="true" /></template>
              {{ showProductFilters ? t("filter.hide") : t("filter.show") }}
              <span v-if="activeProductFilterCount" class="product-filter-count">
                {{ activeProductFilterCount }}
              </span>
              <ChevronDown
                class="product-filter-header-chevron"
                :class="{ 'is-rotated': showProductFilters }"
                aria-hidden="true"
              />
            </BaseButton>
            <div class="page-meta">
              {{
                t("product.showingProductCount", {
                  shown: products.length,
                  total: productStore.totalCount,
                })
              }}
            </div>
          </div>
          <div class="page-meta-actions">
            <CsvExportButton resource="products" size="medium" />
            <BaseButton variant="primary" size="medium" @click="showCreateModal = true">
              <template #icon><Plus aria-hidden="true" /></template>
              {{ t("product.addProduct") }}
            </BaseButton>
          </div>
        </div>

        <PaymentFilterPanel
          v-model="showProductFilters"
          hide-summary
          panel-id="product-filter-panel"
          :active-count="activeProductFilterCount"
        >
          <input
            v-model="filterForm.title"
            class="payment-filter-input"
            :placeholder="t('product.searchPlaceholder')"
          />
          <BaseSelect
            class-name="product-filter-select"
            :model-value="filterForm.status"
            :options="productStatusFilterOptions"
            :aria-label="t('product.filterStatusAny')"
            @update:model-value="
              filterForm.status = String($event || '') as typeof filterForm.status
            "
          />
          <BaseSelect
            class-name="product-filter-select"
            :model-value="filterForm.published_status"
            :options="publicationFilterOptions"
            :aria-label="t('product.filterPublishedAny')"
            @update:model-value="
              filterForm.published_status = String(
                $event || '',
              ) as typeof filterForm.published_status
            "
          />
          <input
            v-model="filterForm.vendor"
            class="payment-filter-input"
            :placeholder="t('product.filterVendorPlaceholder')"
          />
          <input
            v-model="filterForm.product_type"
            class="payment-filter-input"
            :placeholder="t('product.filterTypePlaceholder')"
          />
          <BaseSelect
            class-name="product-filter-select"
            :model-value="filterForm.collection_id"
            :options="collectionFilterOptions"
            :placeholder="t('product.filterCollectionAny')"
            :aria-label="t('product.filterCollectionAny')"
            @update:model-value="filterForm.collection_id = String($event || '')"
          />
          <BaseSelect
            class-name="product-filter-select"
            :model-value="filterForm.sort_key"
            :options="productSortOptions"
            :aria-label="t('product.sortBy')"
            @update:model-value="
              filterForm.sort_key = String($event || 'UPDATED_AT') as ProductSortKey
            "
          />
          <BaseSelect
            class-name="product-filter-select"
            :model-value="filterForm.reverse ? 'DESC' : 'ASC'"
            :options="sortDirectionOptions"
            :aria-label="t('product.sortDirection')"
            @update:model-value="filterForm.reverse = $event !== 'ASC'"
          />
          <BaseButton
            class="product-filter-action product-filter-toggle"
            size="medium"
            type="button"
            :aria-expanded="showAdvancedFilters"
            @click="showAdvancedFilters = !showAdvancedFilters"
          >
            <template #icon><SlidersHorizontal aria-hidden="true" /></template>
            <span class="product-filter-toggle-label">
              {{ t("product.dateFilters") }}
              <ChevronDown
                aria-hidden="true"
                :class="{ 'is-rotated': showAdvancedFilters }"
              />
            </span>
          </BaseButton>
          <div v-if="showAdvancedFilters" class="product-date-filters">
            <label>
              <span>{{ t("product.createdFrom") }}</span>
              <input
                v-model="filterForm.created_at_min"
                class="payment-filter-input"
                type="date"
              />
            </label>
            <label>
              <span>{{ t("product.createdThrough") }}</span>
              <input
                v-model="filterForm.created_at_max"
                class="payment-filter-input"
                type="date"
              />
            </label>
            <label>
              <span>{{ t("product.updatedFrom") }}</span>
              <input
                v-model="filterForm.updated_at_min"
                class="payment-filter-input"
                type="date"
              />
            </label>
            <label>
              <span>{{ t("product.updatedThrough") }}</span>
              <input
                v-model="filterForm.updated_at_max"
                class="payment-filter-input"
                type="date"
              />
            </label>
            <label>
              <span>{{ t("product.publishedFrom") }}</span>
              <input
                v-model="filterForm.published_at_min"
                class="payment-filter-input"
                type="date"
              />
            </label>
            <label>
              <span>{{ t("product.publishedThrough") }}</span>
              <input
                v-model="filterForm.published_at_max"
                class="payment-filter-input"
                type="date"
              />
            </label>
          </div>
          <template #actions>
            <BaseButton size="medium" type="button" @click="resetFilters">
              {{ t("product.resetFilters") }}
            </BaseButton>
          </template>
        </PaymentFilterPanel>

        <div
          v-for="warning in productStore.managementContext?.warnings || []"
          :key="warning"
          class="product-context-warning"
        >
          {{ t(`product.contextWarning.${warning}` as never) }}
        </div>

        <div
          v-if="selectedProductCount"
          class="bulk-toolbar"
          role="region"
          :aria-label="t('product.bulkActions')"
        >
          <strong>
            {{ t("product.bulkSelected", { count: selectedProductCount }) }}
          </strong>
          <div class="bulk-toolbar-actions">
            <BasePopover align="left">
              <template #trigger="{ isOpen, triggerProps }">
                <BaseButton
                  v-bind="triggerProps"
                  variant="ghost"
                  class="publication-picker-trigger"
                  :class="{ 'is-active': isOpen }"
                >
                  <template #icon><RadioTower aria-hidden="true" /></template>
                  {{
                    selectedPublicationIds.length
                      ? t("product.publicationsSelected", {
                          count: selectedPublicationIds.length,
                        })
                      : t("product.choosePublications")
                  }}
                  <ChevronDown aria-hidden="true" />
                </BaseButton>
              </template>
              <div class="publication-picker" role="group">
                <strong>{{ t("product.publicationChannels") }}</strong>
                <p v-if="!productStore.managementContext?.publications.length">
                  {{ t("product.noPublicationsAvailable") }}
                </p>
                <BaseCheckbox
                  v-for="publication in productStore.managementContext?.publications ||
                  []"
                  :key="publication.id"
                  :model-value="selectedPublicationIds.includes(publication.id)"
                  :label="publication.name"
                  :description="publication.catalogTitle || undefined"
                  @change="togglePublication(publication.id)"
                />
              </div>
            </BasePopover>
            <BaseButton
              variant="ghost"
              :disabled="isBulkUpdating"
              @click="runBulkPublication(true)"
            >
              <template #icon><Eye aria-hidden="true" /></template>
              {{
                isBulkUpdating ? t("product.bulkUpdating") : t("product.bulkPublish")
              }}
            </BaseButton>
            <BaseButton
              variant="ghost"
              :disabled="isBulkUpdating"
              @click="runBulkProductAction('ARCHIVE')"
            >
              <template #icon><Archive aria-hidden="true" /></template>
              {{ t("product.bulkArchive") }}
            </BaseButton>
            <BaseButton
              variant="danger-ghost"
              :disabled="isBulkUpdating"
              @click="runBulkProductAction('DELETE')"
            >
              <template #icon><Trash2 aria-hidden="true" /></template>
              {{ t("product.bulkDelete") }}
            </BaseButton>
            <BaseButton
              variant="ghost"
              :disabled="isBulkUpdating"
              @click="runBulkPublication(false)"
            >
              <template #icon><EyeOff aria-hidden="true" /></template>
              {{
                isBulkUpdating ? t("product.bulkUpdating") : t("product.bulkUnpublish")
              }}
            </BaseButton>
            <BaseButton
              variant="ghost"
              :disabled="isBulkUpdating"
              @click="clearBulkSelection"
            >
              <template #icon><X aria-hidden="true" /></template>
              {{ t("common.clear") }}
            </BaseButton>
          </div>
        </div>

        <div class="product-workspace">
          <div
            ref="productList"
            class="card table-card"
            @scroll="updateProductViewport"
          >
            <table class="products-table">
              <thead>
                <tr>
                  <th class="selection-column">
                    <input
                      ref="selectAllCheckbox"
                      type="checkbox"
                      :checked="allProductsSelected"
                      :aria-label="t('product.selectAll')"
                      @change="toggleAllProducts"
                    />
                  </th>
                  <th>{{ t("product.columnProduct") }}</th>
                  <th>{{ t("product.columnStatus") }}</th>
                  <th>{{ t("product.columnVariants") }}</th>
                  <th>{{ t("product.price") }}</th>
                  <th>{{ t("product.columnUpdated") }}</th>
                  <th style="text-align: right">{{ t("product.columnActions") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="productPaddingTop" class="virtual-spacer" aria-hidden="true">
                  <td :style="{ height: `${productPaddingTop}px` }" colspan="7" />
                </tr>
                <tr
                  v-for="{ item: prod, index } in visibleProducts"
                  :key="prod.id || index"
                  class="product-row"
                  :class="{
                    selected: selectedProduct?.id === prod.id,
                    'is-bulk-selected': isProductBulkSelected(prod),
                  }"
                  @click="selectProduct(prod)"
                >
                  <td class="selection-column" @click.stop>
                    <input
                      type="checkbox"
                      :checked="isProductBulkSelected(prod)"
                      :aria-label="
                        t('product.selectProduct', {
                          title: prod.title || String(prod.id),
                        })
                      "
                      @change="toggleProductSelection(prod)"
                    />
                  </td>
                  <td>
                    <div class="product-info-cell">
                      <img
                        v-if="prod.image"
                        :src="prod.image.src"
                        class="product-thumb"
                        :alt="t('product.productImage')"
                      />
                      <div v-else class="product-thumb empty-thumb">
                        {{ t("product.noImage") }}
                      </div>
                      <div class="product-main-details">
                        <div class="product-title-text">{{ prod.title }}</div>
                        <div class="product-id-sub">
                          {{ t("product.productId", { id: prod.id }) }}
                        </div>
                        <div class="product-mobile-facts">
                          <span>
                            {{ t("product.columnVariants") }}:
                            {{ prod.variants_count ?? prod.variants?.length ?? 0 }}
                          </span>
                          <span>{{ formatProductPrice(prod) }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="product-status-cell">
                      <span
                        v-if="prod.status"
                        class="badge"
                        :aria-label="
                          t('a11y.statusLabel', {
                            status: formatProductStatus(prod.status),
                          })
                        "
                        :class="
                          prod.status === 'active' ? 'badge-paid' : 'badge-pending'
                        "
                      >
                        {{ formatProductStatus(prod.status) }}
                      </span>
                      <span
                        class="publication-state"
                        :class="{ published: isProductPublished(prod) }"
                      >
                        {{
                          isProductPublished(prod)
                            ? t("product.published")
                            : t("product.unpublished")
                        }}
                      </span>
                    </div>
                  </td>
                  <td>
                    {{ prod.variants_count ?? prod.variants?.length ?? 0 }}
                  </td>
                  <td>{{ formatProductPrice(prod) }}</td>
                  <td>
                    {{ formatProductDate(prod.updated_at) }}
                  </td>
                  <td style="text-align: right">
                    <div class="product-actions-cell" style="justify-content: flex-end">
                      <BasePopover align="right">
                        <template #trigger="{ isOpen, triggerProps }">
                          <BaseButton
                            v-bind="triggerProps"
                            variant="ghost"
                            icon-only
                            :class="{ 'is-active': isOpen }"
                            :aria-label="t('product.moreActions')"
                          >
                            <template #icon><IconsMore /></template>
                          </BaseButton>
                        </template>
                        <template #default="{ close }">
                          <div class="popover-menu popover-actions">
                            <button
                              role="menuitem"
                              class="popover-item"
                              @click.stop="
                                openDetailModal(prod);
                                close();
                              "
                            >
                              <Eye aria-hidden="true" />
                              {{ t("product.details") }}
                            </button>
                            <button
                              role="menuitem"
                              class="popover-item"
                              @click.stop="
                                openDuplicateModal(prod);
                                close();
                              "
                            >
                              <Copy aria-hidden="true" />
                              {{ t("product.duplicate") }}
                            </button>
                            <button
                              role="menuitem"
                              class="popover-item"
                              @click.stop="
                                openEditModal(prod);
                                close();
                              "
                            >
                              <Pencil aria-hidden="true" />
                              {{ t("common.edit") }}
                            </button>
                            <button
                              role="menuitem"
                              class="popover-item"
                              :disabled="publishingProductId === prod.id"
                              @click.stop="
                                toggleProductPublication(prod);
                                close();
                              "
                            >
                              <EyeOff
                                v-if="isProductPublished(prod)"
                                aria-hidden="true"
                              />
                              <Eye v-else aria-hidden="true" />
                              {{
                                publishingProductId === prod.id
                                  ? t("product.publicationSaving")
                                  : isProductPublished(prod)
                                    ? t("product.unpublish")
                                    : t("product.publish")
                              }}
                            </button>
                            <button
                              role="menuitem"
                              class="popover-item text-danger"
                              @click.stop="
                                removeProduct(prod.id);
                                close();
                              "
                            >
                              <Trash2 aria-hidden="true" />
                              {{ t("common.delete") }}
                            </button>
                          </div>
                        </template>
                      </BasePopover>
                    </div>
                  </td>
                </tr>
                <tr
                  v-if="productPaddingBottom"
                  class="virtual-spacer"
                  aria-hidden="true"
                >
                  <td :style="{ height: `${productPaddingBottom}px` }" colspan="7" />
                </tr>
              </tbody>
            </table>
            <div v-if="products.length === 0" class="empty-state">
              {{ t("product.empty") }}
            </div>
          </div>
          <div v-if="products.length" class="load-more-row" aria-live="polite">
            <span>
              {{
                t("product.loadedPages", {
                  current: productStore.loadedPageCount,
                  total: totalPageCount,
                })
              }}
            </span>
            <BaseButton
              v-if="canLoadMoreProducts"
              :loading="productStore.isLoadingMore"
              @click="loadMoreProducts"
            >
              {{ t("product.loadMore") }}
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <ProductDetailModal
      v-if="detailProduct"
      :product="detailProduct"
      @close="detailProductId = null"
    />

    <!-- Create Modal -->
    <div
      v-if="showCreateModal"
      class="modal-backdrop"
      @click.self="showCreateModal = false"
    >
      <div class="modal-card">
        <div class="modal-head">
          <h3 class="modal-title">{{ t("product.createTitle") }}</h3>
          <BaseButton
            variant="ghost"
            icon-only
            :aria-label="t('common.close')"
            @click="showCreateModal = false"
          >
            <template #icon><X aria-hidden="true" /></template>
          </BaseButton>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label"
              >{{ t("product.fieldTitle") }}
              <span class="required-marker" aria-hidden="true">*</span>
              <span class="sr-only">{{ t("a11y.required") }}</span></label
            >
            <input
              v-model="newProduct.title"
              type="text"
              class="inp"
              :placeholder="t('product.titlePlaceholder')"
            />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.handle") }}</label>
              <input v-model="newProduct.handle" type="text" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.templateSuffix") }}</label>
              <input v-model="newProduct.template_suffix" type="text" class="inp" />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.columnStatus") }}</label>
              <BaseSelect
                class-name="product-form-select"
                :model-value="newProduct.status || 'active'"
                :options="productStatusOptions"
                @update:model-value="
                  newProduct.status = String($event) as ShopifyProductStatus
                "
              />
            </div>
            <label class="field checkbox-field">
              <input
                v-model="newProduct.published"
                type="checkbox"
                :disabled="newProduct.status !== 'active'"
              />
              {{ t("product.publishedToOnlineStore") }}
            </label>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.vendor") }}</label>
              <input
                v-model="newProduct.vendor"
                type="text"
                class="inp"
                :placeholder="t('product.vendorPlaceholder')"
              />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.productType") }}</label>
              <input
                v-model="newProduct.product_type"
                type="text"
                class="inp"
                :placeholder="t('product.typePlaceholder')"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label">{{ t("product.tags") }}</label>
            <input
              v-model="newProduct.tags"
              type="text"
              class="inp"
              :placeholder="t('product.tagsPlaceholder')"
            />
          </div>
          <div class="field">
            <label class="field-label">{{ t("product.descriptionHtml") }}</label>
            <textarea
              v-model="newProduct.body_html"
              class="inp"
              rows="4"
              :placeholder="t('product.descriptionPlaceholder')"
            ></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.defaultPrice") }}</label>
              <LocalizedPriceInput
                v-model="newProductDefaultPrice"
                class="inp"
                :aria-label="t('product.defaultPrice')"
                placeholder="0.00 / 0,00"
                :title="t('product.priceInputHint')"
              />
              <small>{{ t("product.priceInputHint") }}</small>
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.initialImageUrl") }}</label>
              <input v-model="newProductImageUrl" type="url" class="inp" />
            </div>
          </div>
          <div class="field option-editor">
            <div class="option-editor-head">
              <label class="field-label">{{ t("product.optionDefinitions") }}</label>
              <BaseButton
                variant="ghost"
                :disabled="newProductOptions.length >= 3"
                @click="addProductOption"
              >
                <template #icon><Plus aria-hidden="true" /></template>
                {{ t("product.addOption") }}
              </BaseButton>
            </div>
            <div
              v-for="(option, index) in newProductOptions"
              :key="index"
              class="option-row"
            >
              <input
                v-model="option.name"
                class="inp"
                :placeholder="t('product.optionName')"
              />
              <input
                v-model="option.values"
                class="inp"
                :placeholder="t('product.optionValues')"
              />
              <BaseButton
                variant="danger-ghost"
                icon-only
                :aria-label="t('product.removeOption')"
                @click="removeProductOption(index)"
              >
                <template #icon><Trash2 aria-hidden="true" /></template>
              </BaseButton>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t("product.seoTitle") }}</label>
              <input v-model="newProductSeo.title" class="inp" />
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.seoDescription") }}</label>
              <input v-model="newProductSeo.description" class="inp" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <BaseButton size="medium" @click="showCreateModal = false">
            <template #icon><X aria-hidden="true" /></template>
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            size="medium"
            variant="primary"
            @click="createProduct"
            :disabled="productStore.isLoading"
          >
            <template #icon><Plus aria-hidden="true" /></template>
            {{
              productStore.isLoading ? t("product.creating") : t("product.createTitle")
            }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal-backdrop" @click.self="closeEditModal">
      <section
        class="modal-card product-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-edit-title"
      >
        <div class="modal-head">
          <div>
            <h3 id="product-edit-title" class="modal-title">
              {{ t("product.editTitle") }}
            </h3>
            <p>{{ editProduct.title }}</p>
          </div>
          <BaseButton
            variant="ghost"
            icon-only
            :aria-label="t('common.close')"
            @click="closeEditModal"
          >
            <template #icon><X aria-hidden="true" /></template>
          </BaseButton>
        </div>
        <nav
          class="product-edit-nav"
          role="tablist"
          :aria-label="t('product.editSections')"
          @keydown="handleTabKeydown"
        >
          <BaseButton
            class="product-edit-nav-button"
            size="medium"
            :variant="editSection === 'details' ? 'secondary' : 'ghost'"
            :class="{ 'is-active': editSection === 'details' }"
            role="tab"
            :aria-selected="editSection === 'details'"
            @click="editSection = 'details'"
          >
            <template #icon><FileText aria-hidden="true" /></template>
            {{ t("product.editInformation") }}
          </BaseButton>
          <BaseButton
            class="product-edit-nav-button"
            size="medium"
            :variant="editSection === 'variants' ? 'secondary' : 'ghost'"
            :class="{ 'is-active': editSection === 'variants' }"
            role="tab"
            :aria-selected="editSection === 'variants'"
            @click="editSection = 'variants'"
          >
            <template #icon><Boxes aria-hidden="true" /></template>
            {{ t("product.editVariants") }}
          </BaseButton>
          <BaseButton
            class="product-edit-nav-button"
            size="medium"
            :variant="editSection === 'metafields' ? 'secondary' : 'ghost'"
            :class="{ 'is-active': editSection === 'metafields' }"
            role="tab"
            :aria-selected="editSection === 'metafields'"
            @click="editSection = 'metafields'"
          >
            <template #icon><Database aria-hidden="true" /></template>
            {{ t("product.editMetafields") }}
          </BaseButton>
          <BaseButton
            class="product-edit-nav-button"
            size="medium"
            :variant="editSection === 'inventory' ? 'secondary' : 'ghost'"
            :class="{ 'is-active': editSection === 'inventory' }"
            role="tab"
            :aria-selected="editSection === 'inventory'"
            @click="editSection = 'inventory'"
          >
            <template #icon><Warehouse aria-hidden="true" /></template>
            {{ t("product.editInventory") }}
          </BaseButton>
        </nav>
        <div
          class="modal-body"
          :class="{ 'product-catalog-body': editSection !== 'details' }"
        >
          <template v-if="editSection === 'details'">
            <div class="field">
              <label class="field-label"
                >{{ t("product.fieldTitle") }}
                <span class="required-marker" aria-hidden="true">*</span></label
              >
              <input
                v-model="editProduct.title"
                type="text"
                class="inp"
                required
                maxlength="255"
              />
            </div>
            <div class="field-row product-identity-row">
              <div class="field">
                <label class="field-label">{{ t("product.handle") }}</label>
                <input v-model="editProduct.handle" type="text" class="inp" />
              </div>
              <div class="field product-status-field">
                <label class="field-label">{{ t("product.columnStatus") }}</label>
                <div class="product-status-controls">
                  <BaseSelect
                    class-name="product-form-select product-status-select"
                    :model-value="editProduct.status"
                    :options="productStatusOptions"
                    @update:model-value="
                      editProduct.status = String($event) as ShopifyProductStatus
                    "
                  />
                  <BaseCheckbox
                    v-model="editProduct.published"
                    :label="t('product.publishedToOnlineStore')"
                    :disabled="editProduct.status !== 'active'"
                  />
                </div>
              </div>
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.templateSuffix") }}</label>
              <input v-model="editProduct.template_suffix" type="text" class="inp" />
            </div>
            <div class="field-row">
              <div class="field">
                <label class="field-label">{{ t("product.vendor") }}</label>
                <input v-model="editProduct.vendor" type="text" class="inp" />
              </div>
              <div class="field">
                <label class="field-label">{{ t("product.productType") }}</label>
                <input v-model="editProduct.product_type" type="text" class="inp" />
              </div>
              <div class="field">
              <label class="field-label">{{ t("product.tags") }}</label>
              <input v-model="editProduct.tags" type="text" class="inp" />
            </div>
            </div>
            <div class="field">
              <label class="field-label">{{ t("product.descriptionHtml") }}</label>
              <textarea v-model="editProduct.body_html" class="inp" rows="4"></textarea>
            </div>
            <div class="field-row">
              <div class="field">
                <label class="field-label">{{ t("product.seoTitle") }}</label>
                <input v-model="editProduct.seo_title" class="inp" maxlength="255" />
              </div>
              <div class="field">
                <label class="field-label">{{ t("product.seoDescription") }}</label>
                <input
                  v-model="editProduct.seo_description"
                  class="inp"
                  maxlength="320"
                />
              </div>
            </div>
            <div class="advanced-product-fields">
              <div class="advanced-product-heading">
                <div>
                  <strong>{{ t("product.commerceSettings") }}</strong>
                  <p>{{ t("product.commerceSettingsDescription") }}</p>
                </div>
                <span v-if="isAdvancedProductLoading">{{ t("common.loading") }}</span>
              </div>
              <div class="product-commerce-row">
                <div class="field product-category-field">
                  <label class="field-label">{{ t("product.shopifyCategory") }}</label>
                  <input
                    v-model.trim="editProduct.category_id"
                    class="inp"
                    placeholder="gid://shopify/TaxonomyCategory/sg-..."
                  />
                  <small>{{ t("product.shopifyCategoryHint") }}</small>
                </div>
                <div class="field product-collections-field">
                  <label class="field-label">{{ t("product.collections") }}</label>
                  <div
                    v-if="productStore.managementContext?.collections.length"
                    class="product-collection-picker"
                  >
                    <BaseCheckbox
                      v-for="collection in productStore.managementContext.collections"
                      :key="collection.id"
                      :model-value="editProduct.collection_ids.includes(collection.id)"
                      :label="collection.title"
                      :description="
                        t('product.collectionProductCount', {
                          count: collection.productsCount,
                        })
                      "
                      @change="toggleEditCollection(collection.id)"
                    />
                  </div>
                  <div v-else class="product-form-empty">
                    {{ t("product.noCollectionsAvailable") }}
                  </div>
                  <small v-if="editProduct.collections_truncated">
                    {{ t("product.assignedCollectionsTruncated") }}
                  </small>
                </div>
              </div>
              <div class="field-row product-readonly-facts">
                <div>
                  <span>{{ t("product.productKind") }}</span>
                  <strong>{{
                    editProduct.is_gift_card
                      ? t("product.giftCardProduct")
                      : t("product.standardProduct")
                  }}</strong>
                </div>
                <div class="field checkbox-field compact-checkbox">
                  <BaseCheckbox
                    v-model="editProduct.requires_selling_plan"
                    :label="t('product.subscriptionOnly')"
                    :description="t('product.subscriptionOnlyHint')"
                  />
                </div>
              </div>
              <div v-if="editProduct.selling_plan_groups.length" class="field">
                <label class="field-label">{{ t("product.sellingPlanGroups") }}</label>
                <div class="product-plan-chips">
                  <span
                    v-for="group in editProduct.selling_plan_groups"
                    :key="group.id"
                  >
                    {{ group.name }}
                  </span>
                </div>
                <small>{{ t("product.sellingPlanOwnershipHint") }}</small>
              </div>
            </div>
          </template>
          <div v-else class="product-catalog-editor">
            <div v-if="isEditingProductDetailLoading" class="product-edit-loading">
              <LoaderCircle class="loading-icon" aria-hidden="true" />
              {{ t("product.loadingCatalogEditor") }}
            </div>
            <div v-else-if="editingProductDetailError" class="product-edit-error">
              <span role="alert">{{ editingProductDetailError }}</span>
              <BaseButton @click="loadEditingProductRecord">
                {{ t("common.retry") }}
              </BaseButton>
            </div>
            <template v-else-if="editingProductRecord">
              <ProductOperationsPanel
                :product="editingProductRecord"
                :section="productOperationSection"
                @refreshed="refreshEditingProduct"
              />
              <ProductMediaManager
                v-if="editSection === 'variants'"
                :product-id="editingProductRecord.id"
                @refreshed="refreshEditingProduct"
              />
            </template>
          </div>
        </div>
        <div class="modal-actions">
          <BaseButton size="medium" @click="closeEditModal">
            <template #icon><X aria-hidden="true" /></template>
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            v-if="editSection === 'details'"
            variant="primary"
            size="medium"
            :loading="isAdvancedProductLoading || isSavingProductEdit"
            @click="saveEditProduct"
          >
            <template #icon><Save aria-hidden="true" /></template>
            {{
              isAdvancedProductLoading
                ? t("common.loading")
                : isSavingProductEdit
                  ? t("product.saving")
                  : t("product.saveProductInformation")
            }}
          </BaseButton>
        </div>
      </section>
    </div>

    <div
      v-if="duplicateProductSource"
      class="modal-backdrop"
      @click.self="duplicateProductSource = null"
    >
      <form class="modal-card duplicate-modal" @submit.prevent="submitDuplicateProduct">
        <div class="modal-head">
          <div>
            <h3 class="modal-title">{{ t("product.duplicateTitle") }}</h3>
            <p>{{ duplicateProductSource.title }}</p>
          </div>
          <BaseButton
            variant="ghost"
            icon-only
            :aria-label="t('common.close')"
            @click="duplicateProductSource = null"
          >
            <template #icon><X aria-hidden="true" /></template>
          </BaseButton>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="field-label">{{ t("product.duplicateNewTitle") }}</label>
            <input v-model="duplicateForm.title" required maxlength="255" class="inp" />
          </div>
          <div class="field">
            <label class="field-label">{{ t("product.columnStatus") }}</label>
            <BaseSelect
              class-name="product-form-select"
              :model-value="duplicateForm.status"
              :options="duplicateStatusOptions"
              @update:model-value="
                duplicateForm.status = String($event) as typeof duplicateForm.status
              "
            />
          </div>
          <div class="product-context-warning">
            {{ t("product.duplicateAsyncHint") }}
          </div>
        </div>
        <div class="modal-actions">
          <BaseButton size="medium" @click="duplicateProductSource = null">
            {{ t("common.cancel") }}
          </BaseButton>
          <BaseButton
            size="medium"
            variant="primary"
            type="submit"
            :disabled="productStore.isLoading"
          >
            <template #icon><Copy aria-hidden="true" /></template>
            {{ t("product.duplicate") }}
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Archive,
  Boxes,
  ChevronDown,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  RadioTower,
  Save,
  SlidersHorizontal,
  Trash2,
  Warehouse,
  X,
} from "@lucide/vue";
import { computed, nextTick, ref, watch } from "vue";
import LocalizedPriceInput from "~/components/product/LocalizedPriceInput.vue";
import { useActiveShopAuth } from "~/composables/useActiveShopAuth";
import { useStoreFeedback } from "~/composables/useStoreFeedback";
import { useFormStore } from "~/stores/form";
import { useProductStore } from "~/stores/product";
import type {
  ShopifyNumericId,
  ShopifyProduct,
  ShopifyProductInput,
  ShopifyProductStatus,
} from "~~/types/shopify";
import type { ProductListQuery, ProductSortKey } from "~~/types/shopify-product";
import {
  buildVariantsFromOptions,
  normalizeProductPriceInput,
  normalizeProductOptions,
  type ProductOptionDraft,
} from "~~/utils/product-options";

const productStore = useProductStore();
const formStore = useFormStore();
const { token: activeToken } = useActiveShopAuth();
const feedback = useStoreFeedback();
const { t, locale } = useLocalization();
const { requestConfirmation } = useConfirmDialog();
const { handleTabKeydown } = useTabKeyboardNavigation();

const products = computed(() => productStore.products);
const {
  container: productList,
  paddingBottom: productPaddingBottom,
  paddingTop: productPaddingTop,
  updateViewport: updateProductViewport,
  visibleItems: visibleProducts,
} = useVirtualList(products, {
  itemHeight: 65,
  overscan: 6,
  defaultViewportHeight: 600,
  getItemKey: (product) => String(product.id),
});
const totalPageCount = computed(() =>
  Math.max(
    productStore.loadedPageCount,
    productStore.totalCount
      ? Math.ceil(productStore.totalCount / productStore.pageSize)
      : 0,
  ),
);
const canLoadMoreProducts = computed(
  () =>
    Boolean(productStore.nextCursor) && products.value.length < productStore.totalCount,
);
const selectedProductId = ref<ShopifyNumericId | null>(null);
const selectedProductIds = ref<Set<string>>(new Set());
const selectAllCheckbox = ref<HTMLInputElement | null>(null);
const isBulkUpdating = ref(false);
const selectedPublicationIds = ref<string[]>([]);
const selectedProductCount = computed(() => selectedProductIds.value.size);
const allProductsSelected = computed(
  () =>
    products.value.length > 0 &&
    products.value.every((product) => selectedProductIds.value.has(String(product.id))),
);
const selectedProduct = computed(() => {
  return (
    products.value.find((product) => product.id === selectedProductId.value) || null
  );
});
const detailProductId = ref<ShopifyNumericId | null>(null);
const detailProductRecord = ref<ShopifyProduct | null>(null);
const detailProduct = computed(() =>
  detailProductId.value ? detailProductRecord.value : null,
);

// ── Local state for modals ──
const showCreateModal = ref(false);
const showEditModal = ref(false);
const editSection = ref<"details" | "variants" | "metafields" | "inventory">("details");
const productOperationSection = computed(() =>
  editSection.value === "details" ? "variants" : editSection.value,
);
const editingProductRecord = ref<ShopifyProduct | null>(null);
const isEditingProductDetailLoading = ref(false);
const editingProductDetailError = ref("");
const publishingProductId = ref<ShopifyNumericId | null>(null);
const showProductFilters = ref(false);
const showAdvancedFilters = ref(false);
const isAdvancedProductLoading = ref(false);
const isSavingProductEdit = ref(false);
const duplicateProductSource = ref<ShopifyProduct | null>(null);
let advancedProductRequestSequence = 0;
const duplicateForm = ref({
  title: "",
  status: "DRAFT" as "ACTIVE" | "ARCHIVED" | "DRAFT" | "UNLISTED",
});
const filterForm = ref({
  title: "",
  status: "" as "" | ShopifyProductStatus,
  published_status: "" as "" | "published" | "unpublished",
  vendor: "",
  product_type: "",
  collection_id: "",
  created_at_min: "",
  created_at_max: "",
  updated_at_min: "",
  updated_at_max: "",
  published_at_min: "",
  published_at_max: "",
  sort_key: "UPDATED_AT" as ProductSortKey,
  reverse: true,
});
const activeProductFilterCount = computed(() => {
  const values = [
    filterForm.value.title,
    filterForm.value.status,
    filterForm.value.published_status,
    filterForm.value.vendor,
    filterForm.value.product_type,
    filterForm.value.collection_id,
    filterForm.value.created_at_min,
    filterForm.value.created_at_max,
    filterForm.value.updated_at_min,
    filterForm.value.updated_at_max,
    filterForm.value.published_at_min,
    filterForm.value.published_at_max,
  ];
  return (
    values.filter((value) => String(value).trim()).length +
    (filterForm.value.sort_key === "UPDATED_AT" ? 0 : 1) +
    (filterForm.value.reverse ? 0 : 1)
  );
});
const standardProductFilterSignature = computed(() =>
  JSON.stringify([
    filterForm.value.status,
    filterForm.value.published_status,
    filterForm.value.vendor,
    filterForm.value.product_type,
    filterForm.value.collection_id,
    filterForm.value.created_at_min,
    filterForm.value.created_at_max,
    filterForm.value.updated_at_min,
    filterForm.value.updated_at_max,
    filterForm.value.published_at_min,
    filterForm.value.published_at_max,
    filterForm.value.sort_key,
    filterForm.value.reverse,
  ]),
);
let suppressAutomaticProductFilters = false;
let cancelTitleAutoFilter = () => {};
let cancelStandardAutoFilter = () => {};
const titleAutoFilter = useDebouncedWatch(
  () => filterForm.value.title,
  () => {
    if (suppressAutomaticProductFilters) return;
    cancelStandardAutoFilter();
    return applyProductFilters();
  },
  650,
);
cancelTitleAutoFilter = titleAutoFilter.cancel;
const standardAutoFilter = useDebouncedWatch(
  standardProductFilterSignature,
  () => {
    if (suppressAutomaticProductFilters) return;
    cancelTitleAutoFilter();
    return applyProductFilters();
  },
  250,
);
cancelStandardAutoFilter = standardAutoFilter.cancel;
const productStatusOptions = computed(() => [
  { label: t("product.statusActive"), value: "active" },
  { label: t("product.statusDraft"), value: "draft" },
  { label: t("product.statusArchived"), value: "archived" },
  { label: t("product.statusUnlisted"), value: "unlisted" },
]);
const productStatusFilterOptions = computed(() => [
  { label: t("product.filterStatusAny"), value: "" },
  ...productStatusOptions.value,
]);
const publicationFilterOptions = computed(() => [
  { label: t("product.filterPublishedAny"), value: "" },
  { label: t("product.filterPublished"), value: "published" },
  { label: t("product.filterUnpublished"), value: "unpublished" },
]);
const collectionFilterOptions = computed(() => [
  { label: t("product.filterCollectionAny"), value: "" },
  ...(productStore.managementContext?.collections || []).map((collection) => ({
    label: collection.title,
    value: String(collection.legacyResourceId),
    description: t("product.collectionProductCount", {
      count: collection.productsCount,
    }),
  })),
]);
const productSortOptions = computed(() => [
  { label: t("product.sortUpdated"), value: "UPDATED_AT" },
  { label: t("product.sortCreated"), value: "CREATED_AT" },
  { label: t("product.sortPublished"), value: "PUBLISHED_AT" },
  { label: t("product.sortTitle"), value: "TITLE" },
  { label: t("product.sortInventory"), value: "INVENTORY_TOTAL" },
  { label: t("product.sortVendor"), value: "VENDOR" },
  { label: t("product.sortProductType"), value: "PRODUCT_TYPE" },
]);
const sortDirectionOptions = computed(() => [
  { label: t("product.sortDescending"), value: "DESC" },
  { label: t("product.sortAscending"), value: "ASC" },
]);
const duplicateStatusOptions = computed(() => [
  { label: t("product.statusDraft"), value: "DRAFT" },
  { label: t("product.statusActive"), value: "ACTIVE" },
  { label: t("product.statusArchived"), value: "ARCHIVED" },
  { label: t("product.statusUnlisted"), value: "UNLISTED" },
]);

const newProduct = ref<ShopifyProductInput>({
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
  tags: "",
  status: "active",
  published: true,
  handle: "",
  template_suffix: null,
});
const newProductOptions = ref<ProductOptionDraft[]>([{ name: "", values: "" }]);
const newProductDefaultPrice = ref("0.00");
const newProductImageUrl = ref("");
const newProductSeo = ref({ title: "", description: "" });

const editProduct = ref({
  id: null as ShopifyNumericId | null,
  title: "",
  body_html: "",
  vendor: "",
  product_type: "",
  tags: "",
  status: "active" as ShopifyProductStatus,
  published: true,
  published_at: null as string | null,
  handle: "",
  template_suffix: "" as string | null,
  seo_title: "",
  seo_description: "",
  category_id: "",
  is_gift_card: false,
  requires_selling_plan: false,
  original_requires_selling_plan: false,
  collection_ids: [] as string[],
  original_collection_ids: [] as string[],
  collections_truncated: false,
  selling_plan_groups: [] as Array<{
    id: string;
    name: string;
    merchantCode: string;
  }>,
});

watch(
  [() => formStore.storeId, activeToken],
  async ([sid, token]) => {
    if (!sid || !token) return;
    const context = await productStore.fetchManagementContext(sid, token);
    if (!context || selectedPublicationIds.value.length) return;
    const onlineStore = context.publications.find(
      (publication) => publication.onlineStore,
    );
    if (onlineStore) selectedPublicationIds.value = [onlineStore.id];
  },
  { immediate: true },
);

// ── Actions ──
function selectProduct(prod: ShopifyProduct) {
  selectedProductId.value = prod.id;
}

function isProductBulkSelected(prod: ShopifyProduct) {
  return selectedProductIds.value.has(String(prod.id));
}

function toggleProductSelection(prod: ShopifyProduct) {
  const next = new Set(selectedProductIds.value);
  const id = String(prod.id);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedProductIds.value = next;
}

function toggleAllProducts() {
  selectedProductIds.value = allProductsSelected.value
    ? new Set()
    : new Set(products.value.map((product) => String(product.id)));
}

function clearBulkSelection() {
  selectedProductIds.value = new Set();
}

function togglePublication(id: string) {
  selectedPublicationIds.value = selectedPublicationIds.value.includes(id)
    ? selectedPublicationIds.value.filter((item) => item !== id)
    : [...selectedPublicationIds.value, id];
}

function selectedProducts() {
  return products.value
    .filter((product) => selectedProductIds.value.has(String(product.id)))
    .map((product) => product.id);
}

async function runBulkPublication(publish: boolean) {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  const selected = selectedProducts();
  if (!selected.length) return;
  if (
    productStore.managementContext?.publications.length &&
    !selectedPublicationIds.value.length
  ) {
    feedback.warning(t("product.choosePublicationRequired"));
    return;
  }

  isBulkUpdating.value = true;
  try {
    const result = await productStore.setProductsPublished(
      sid,
      token,
      selected,
      publish,
      selectedPublicationIds.value,
    );
    selectedProductIds.value = new Set(result.failedIds.map(String));

    if (result.failedIds.length) {
      feedback.error(
        t("product.bulkPublicationPartial", {
          succeeded: result.succeeded,
          failed: result.failedIds.length,
        }),
      );
    } else {
      feedback.success(
        t(publish ? "product.bulkPublishSuccess" : "product.bulkUnpublishSuccess", {
          count: result.succeeded,
        }),
      );
    }
  } finally {
    isBulkUpdating.value = false;
  }
}

async function runBulkProductAction(action: "ARCHIVE" | "DELETE") {
  const sid = formStore.storeId;
  const token = activeToken.value;
  const selected = selectedProducts();
  if (!sid || !token || !selected.length) return;
  const confirmed = await requestConfirmation({
    title: t(
      action === "DELETE"
        ? "product.bulkDeleteConfirmTitle"
        : "product.bulkArchiveConfirmTitle",
    ),
    message: t(
      action === "DELETE"
        ? "product.bulkDeleteConfirmMessage"
        : "product.bulkArchiveConfirmMessage",
      { count: selected.length },
    ),
    confirmLabel: t(action === "DELETE" ? "product.bulkDelete" : "product.bulkArchive"),
    danger: action === "DELETE",
  });
  if (!confirmed) return;
  isBulkUpdating.value = true;
  try {
    const result = await productStore.runBulkAction(sid, token, selected, action);
    selectedProductIds.value = new Set(result.failedIds.map(String));
    if (result.failedIds.length) {
      feedback.error(
        t("product.bulkActionPartial", {
          succeeded: result.succeeded,
          failed: result.failedIds.length,
        }),
      );
    } else {
      feedback.success(
        t(
          action === "DELETE"
            ? "product.bulkDeleteSuccess"
            : "product.bulkArchiveSuccess",
          {
            count: result.succeeded,
          },
        ),
      );
    }
  } finally {
    isBulkUpdating.value = false;
  }
}

function openDuplicateModal(product: ShopifyProduct) {
  duplicateProductSource.value = product;
  duplicateForm.value = {
    title: t("product.duplicateDefaultTitle", { title: product.title }),
    status: "DRAFT",
  };
}

async function submitDuplicateProduct() {
  const source = duplicateProductSource.value;
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!source || !sid || !token || !duplicateForm.value.title.trim()) return;
  const result = await productStore.duplicateProduct(sid, token, source.id, {
    newTitle: duplicateForm.value.title.trim(),
    newStatus: duplicateForm.value.status,
  });
  if (!result) {
    feedback.error(productStore.error, t("product.duplicateFailed"));
    return;
  }
  duplicateProductSource.value = null;
  feedback.success(
    result.queued ? t("product.duplicateQueued") : t("product.duplicateSuccess"),
  );
}

watch(
  [selectedProductCount, allProductsSelected],
  () => {
    void nextTick(() => {
      if (selectAllCheckbox.value) {
        selectAllCheckbox.value.indeterminate =
          selectedProductCount.value > 0 && !allProductsSelected.value;
      }
    });
  },
  { immediate: true },
);

watch(products, (nextProducts) => {
  const validIds = new Set(nextProducts.map((product) => String(product.id)));
  selectedProductIds.value = new Set(
    [...selectedProductIds.value].filter((id) => validIds.has(id)),
  );
});

function isProductPublished(prod: ShopifyProduct) {
  return prod.status === "active" && Boolean(prod.published_at);
}

async function openDetailModal(prod: ShopifyProduct) {
  selectProduct(prod);
  detailProductId.value = prod.id;
  detailProductRecord.value = prod;
  await loadProductDetail(prod.id);
}

function formatProductStatus(status?: ShopifyProductStatus) {
  if (status === "active") return t("product.statusActive");
  if (status === "draft") return t("product.statusDraft");
  if (status === "archived") return t("product.statusArchived");
  if (status === "unlisted") return t("product.statusUnlisted");
  return t("product.statusUnknown");
}

function formatProductDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(locale.value);
}

function formatProductPrice(product: ShopifyProduct) {
  if (product.min_price !== undefined && product.max_price !== undefined) {
    const range =
      product.min_price === product.max_price
        ? product.min_price
        : `${product.min_price} - ${product.max_price}`;
    return product.price_currency ? `${range} ${product.price_currency}` : range;
  }
  const prices = (product.variants || [])
    .map((variant) => Number(variant.price))
    .filter(Number.isFinite);
  if (!prices.length) return "-";
  const minimum = Math.min(...prices).toFixed(2);
  const maximum = Math.max(...prices).toFixed(2);
  return minimum === maximum ? minimum : `${minimum} - ${maximum}`;
}

async function loadProductDetail(productId: ShopifyNumericId) {
  const product = await fetchProductDetailRecord(productId);
  if (detailProductId.value === productId && product) {
    detailProductRecord.value = {
      ...(detailProductRecord.value || {}),
      ...product,
    } as ShopifyProduct;
  }
}

async function fetchProductDetailRecord(productId: ShopifyNumericId) {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return null;
  try {
    const response = await $fetch<{ product?: ShopifyProduct }>(
      `/api/product/${productId}`,
      {
        query: { storeId: sid },
        headers: { "X-Shopify-Access-Token": token },
      },
    );
    return response.product || null;
  } catch {
    return null;
  }
}

function addProductOption() {
  if (newProductOptions.value.length < 3) {
    newProductOptions.value.push({ name: "", values: "" });
  }
}

function removeProductOption(index: number) {
  newProductOptions.value.splice(index, 1);
}

async function applyProductFilters() {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return;
  clearBulkSelection();
  await productStore.fetchAll(sid, token, 50, toProductFilters());
}

async function resetFilters() {
  suppressAutomaticProductFilters = true;
  filterForm.value = {
    title: "",
    status: "",
    published_status: "",
    vendor: "",
    product_type: "",
    collection_id: "",
    created_at_min: "",
    created_at_max: "",
    updated_at_min: "",
    updated_at_max: "",
    published_at_min: "",
    published_at_max: "",
    sort_key: "UPDATED_AT",
    reverse: true,
  };
  await nextTick();
  cancelTitleAutoFilter();
  cancelStandardAutoFilter();
  suppressAutomaticProductFilters = false;
  await applyProductFilters();
}

function toProductFilters(): ProductListQuery {
  const filters: ProductListQuery = {
    ...Object.fromEntries(
      Object.entries(filterForm.value).filter(
        ([, value]) => typeof value === "boolean" || String(value).trim(),
      ),
    ),
    sort_key: filterForm.value.sort_key,
    reverse: filterForm.value.reverse,
  };
  for (const key of ["created_at_min", "updated_at_min", "published_at_min"] as const) {
    const value = filterForm.value[key];
    if (value) filters[key] = `${value}T00:00:00.000Z`;
  }
  for (const key of ["created_at_max", "updated_at_max", "published_at_max"] as const) {
    const value = filterForm.value[key];
    if (value) filters[key] = `${value}T23:59:59.999Z`;
  }
  return filters;
}

async function loadMoreProducts() {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return;
  await productStore.fetchNext(sid, token);
}

async function createProduct() {
  const sid = formStore.storeId;
  const token = activeToken.value;

  if (!sid || !token) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  let options;
  let variants;
  const imageUrl = newProductImageUrl.value.trim();
  try {
    const defaultPrice = normalizeProductPriceInput(newProductDefaultPrice.value);
    if (defaultPrice === null) throw new Error("price");
    options = normalizeProductOptions(newProductOptions.value);
    variants = buildVariantsFromOptions(options, {
      price: defaultPrice,
    });
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) throw new Error("image");
  } catch {
    feedback.error(t("product.productOptionsInvalid"));
    return;
  }
  const metafields = [
    ...(newProductSeo.value.title.trim()
      ? [
          {
            namespace: "global",
            key: "title_tag",
            value: newProductSeo.value.title.trim(),
            type: "single_line_text_field",
          },
        ]
      : []),
    ...(newProductSeo.value.description.trim()
      ? [
          {
            namespace: "global",
            key: "description_tag",
            value: newProductSeo.value.description.trim(),
            type: "single_line_text_field",
          },
        ]
      : []),
  ];
  const success = await productStore.createProduct(sid, token, {
    ...newProduct.value,
    template_suffix: newProduct.value.template_suffix || null,
    published: newProduct.value.status === "active" && newProduct.value.published,
    ...(options.length ? { options } : {}),
    variants,
    ...(imageUrl ? { images: [{ src: imageUrl }] } : {}),
    ...(metafields.length ? { metafields } : {}),
  });
  if (success) {
    showCreateModal.value = false;
    newProduct.value = {
      title: "",
      body_html: "",
      vendor: "",
      product_type: "",
      tags: "",
      status: "active",
      published: true,
      handle: "",
      template_suffix: null,
    };
    newProductOptions.value = [{ name: "", values: "" }];
    newProductDefaultPrice.value = "0.00";
    newProductImageUrl.value = "";
    newProductSeo.value = { title: "", description: "" };
    feedback.success(t("product.created"));
  } else {
    feedback.error(productStore.error, t("product.createFailed"));
  }
}

async function openEditModal(prod: ShopifyProduct) {
  const requestId = ++advancedProductRequestSequence;
  isSavingProductEdit.value = false;
  editSection.value = "details";
  editingProductRecord.value = prod;
  editingProductDetailError.value = "";
  editProduct.value = {
    id: prod.id,
    title: prod.title || "",
    body_html: prod.body_html || "",
    vendor: prod.vendor || "",
    product_type: prod.product_type || "",
    tags: prod.tags || "",
    status: prod.status || "draft",
    published: isProductPublished(prod),
    published_at: prod.published_at || null,
    handle: prod.handle || "",
    template_suffix: prod.template_suffix || "",
    seo_title: prod.seo?.title || "",
    seo_description: prod.seo?.description || "",
    category_id: prod.category?.id || "",
    is_gift_card: Boolean(prod.is_gift_card),
    requires_selling_plan: Boolean(prod.requires_selling_plan),
    original_requires_selling_plan: Boolean(prod.requires_selling_plan),
    collection_ids: [],
    original_collection_ids: [],
    collections_truncated: false,
    selling_plan_groups: [],
  };
  showEditModal.value = true;

  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) {
    editingProductDetailError.value = t("product.credentialsMissing");
    return;
  }
  isAdvancedProductLoading.value = true;
  isEditingProductDetailLoading.value = true;
  const [, advanced, detailedProduct] = await Promise.all([
    productStore.fetchManagementContext(sid, token),
    productStore.fetchAdvancedDetails(sid, token, prod.id),
    fetchProductDetailRecord(prod.id),
  ]);
  if (requestId !== advancedProductRequestSequence) return;
  isAdvancedProductLoading.value = false;
  isEditingProductDetailLoading.value = false;
  if (detailedProduct) {
    editingProductRecord.value = {
      ...prod,
      ...detailedProduct,
    } as ShopifyProduct;
  } else {
    editingProductDetailError.value = t("product.editCatalogLoadFailed");
  }
  if (!showEditModal.value || !advanced || editProduct.value.id !== prod.id) return;
  const collectionIds = advanced.collections.map((collection) => collection.id);
  editProduct.value.category_id = advanced.category?.id || "";
  editProduct.value.seo_title = advanced.seo.title || "";
  editProduct.value.seo_description = advanced.seo.description || "";
  editProduct.value.is_gift_card = advanced.isGiftCard;
  editProduct.value.requires_selling_plan = advanced.requiresSellingPlan;
  editProduct.value.original_requires_selling_plan = advanced.requiresSellingPlan;
  editProduct.value.collection_ids = collectionIds;
  editProduct.value.original_collection_ids = [...collectionIds];
  editProduct.value.collections_truncated = advanced.collectionsTruncated;
  editProduct.value.selling_plan_groups = advanced.sellingPlanGroups;
}

function closeEditModal() {
  if (isSavingProductEdit.value) return;
  advancedProductRequestSequence += 1;
  showEditModal.value = false;
  isAdvancedProductLoading.value = false;
  isEditingProductDetailLoading.value = false;
  editingProductDetailError.value = "";
  editingProductRecord.value = null;
}

async function loadEditingProductRecord() {
  const productId = editProduct.value.id;
  if (!showEditModal.value || !productId || isEditingProductDetailLoading.value) return;
  const requestId = advancedProductRequestSequence;
  isEditingProductDetailLoading.value = true;
  editingProductDetailError.value = "";
  const product = await fetchProductDetailRecord(productId);
  if (
    requestId !== advancedProductRequestSequence ||
    !showEditModal.value ||
    editProduct.value.id !== productId
  ) {
    return;
  }
  isEditingProductDetailLoading.value = false;
  if (!product) {
    editingProductDetailError.value = t("product.editCatalogLoadFailed");
    return;
  }
  editingProductRecord.value = {
    ...(editingProductRecord.value || {}),
    ...product,
  } as ShopifyProduct;
}

async function refreshEditingProduct() {
  const productId = editProduct.value.id;
  if (!productId) return;
  await refreshProducts();
  await loadEditingProductRecord();
}

function toggleEditCollection(id: string) {
  editProduct.value.collection_ids = editProduct.value.collection_ids.includes(id)
    ? editProduct.value.collection_ids.filter((item) => item !== id)
    : [...editProduct.value.collection_ids, id];
}

async function saveEditProduct() {
  const sid = formStore.storeId;
  const token = activeToken.value;

  if (!sid || !token || !editProduct.value.id) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  editProduct.value.title = editProduct.value.title.trim();
  if (!editProduct.value.title) {
    feedback.error(t("product.titleRequired"));
    return;
  }

  const shouldPublish =
    editProduct.value.status === "active" && editProduct.value.published;

  const categoryId = editProduct.value.category_id.trim();
  if (categoryId && !categoryId.startsWith("gid://shopify/TaxonomyCategory/")) {
    feedback.error(t("product.shopifyCategoryInvalid"));
    return;
  }
  if (
    editProduct.value.requires_selling_plan &&
    !editProduct.value.original_requires_selling_plan
  ) {
    const confirmed = await requestConfirmation({
      title: t("product.subscriptionOnlyConfirmTitle"),
      message: t("product.subscriptionOnlyConfirmMessage"),
      confirmLabel: t("product.saveChanges"),
    });
    if (!confirmed) return;
  }
  isSavingProductEdit.value = true;
  const advanced = await productStore.updateAdvancedDetails(
    sid,
    token,
    editProduct.value.id,
    {
      title: editProduct.value.title,
      descriptionHtml: editProduct.value.body_html,
      vendor: editProduct.value.vendor,
      productType: editProduct.value.product_type,
      tags: editProduct.value.tags,
      status: editProduct.value.status.toUpperCase(),
      handle: editProduct.value.handle.trim(),
      templateSuffix: editProduct.value.template_suffix?.trim() || null,
      categoryId: categoryId || null,
      seo: {
        title: editProduct.value.seo_title,
        description: editProduct.value.seo_description,
      },
      requiresSellingPlan: editProduct.value.requires_selling_plan,
      collectionsToJoin: editProduct.value.collection_ids.filter(
        (id) => !editProduct.value.original_collection_ids.includes(id),
      ),
      collectionsToLeave: editProduct.value.original_collection_ids.filter(
        (id) => !editProduct.value.collection_ids.includes(id),
      ),
    },
  );
  if (!advanced) {
    isSavingProductEdit.value = false;
    feedback.error(productStore.error, t("product.updateFailed"));
    return;
  }
  const onlineStorePublication = productStore.managementContext?.publications.find(
    (publication) => publication.onlineStore,
  );
  const publicationResult = await productStore.setProductsPublished(
    sid,
    token,
    [editProduct.value.id],
    shouldPublish,
    onlineStorePublication ? [onlineStorePublication.id] : [],
  );
  isSavingProductEdit.value = false;
  if (publicationResult.failedIds.length) {
    feedback.warning(t("product.savedPublicationFailed"));
  } else {
    feedback.success(t("product.saved"));
  }
  closeEditModal();
}

async function toggleProductPublication(prod: ShopifyProduct) {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  const publish = !isProductPublished(prod);
  publishingProductId.value = prod.id;
  try {
    const onlineStorePublication = productStore.managementContext?.publications.find(
      (publication) => publication.onlineStore,
    );
    const result = await productStore.setProductsPublished(
      sid,
      token,
      [prod.id],
      publish,
      onlineStorePublication ? [onlineStorePublication.id] : [],
    );

    if (!result.failedIds.length) {
      feedback.success(
        publish ? t("product.publishSuccess") : t("product.unpublishSuccess"),
      );
    } else {
      feedback.error(
        productStore.error,
        publish ? t("product.publishFailed") : t("product.unpublishFailed"),
      );
    }
  } finally {
    publishingProductId.value = null;
  }
}

async function removeProduct(prodId: ShopifyNumericId) {
  if (
    !(await requestConfirmation({
      title: t("confirm.deleteTitle"),
      message: t("product.deleteConfirm"),
      confirmLabel: t("common.delete"),
    }))
  ) {
    return;
  }
  const sid = formStore.storeId;
  const token = activeToken.value;

  if (!sid || !token) {
    feedback.error(t("product.credentialsMissing"));
    return;
  }

  const success = await productStore.deleteProduct(sid, token, prodId);
  if (success) {
    const nextSelection = new Set(selectedProductIds.value);
    nextSelection.delete(String(prodId));
    selectedProductIds.value = nextSelection;
    feedback.success(t("product.deleted"));
  } else {
    feedback.error(productStore.error, t("product.deleteFailed"));
  }
}

async function refreshProducts() {
  const sid = formStore.storeId;
  const token = activeToken.value;
  if (!sid || !token) return;
  await productStore.fetchAll(sid, token, productStore.pageSize, productStore.filters);
}
</script>

<style scoped>
.page-meta-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-meta-left,
.page-meta-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-meta {
  font-size: 13px;
  color: var(--text-sub);
}
.products-tab :deep(.payment-filter-panel) {
  overflow: visible;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 12px;
}

.products-tab :deep(.payment-filter-fields) {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 145px), 1fr));
  gap: 8px;
}

.product-filter-header-button {
  flex: 0 0 auto;
}
.product-filter-count {
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  border-radius: 999px;
  background: var(--green);
  color: var(--on-accent);
  font-size: 10px;
  line-height: 1;
}
.product-filter-header-chevron {
  width: 14px;
  height: 14px;
  transition: transform 0.16s ease;
}
.product-filter-header-chevron.is-rotated {
  transform: rotate(180deg);
}

.product-filter-select :deep(.select-trigger),
.product-form-select :deep(.select-trigger) {
  width: 100%;
  min-height: var(--control-height-md);
}
.product-filter-select :deep(.select-dropdown),
.product-form-select :deep(.select-dropdown) {
  min-width: min(280px, calc(100vw - 32px));
}
.product-filter-action {
  width: 100%;
  min-width: 0;
}
.product-filter-toggle {
  justify-content: center;
  white-space: nowrap;
}
.product-filter-toggle-label {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.product-filter-toggle :deep(svg),
.product-filter-toggle-label svg {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}
.product-filter-toggle-label svg {
  transition: transform 0.16s ease;
}
.product-filter-toggle-label svg.is-rotated {
  transform: rotate(180deg);
}
.product-date-filters {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-low);
}
.product-date-filters label {
  min-width: 0;
  display: grid;
  gap: 5px;
}
.product-date-filters span {
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
}
.product-context-warning {
  margin-bottom: 10px;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--amber) 30%, var(--border));
  border-radius: 7px;
  background: var(--amber-soft);
  color: var(--text);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.bulk-toolbar {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  border: 1px solid color-mix(in srgb, var(--green) 35%, var(--border));
  border-radius: var(--radius-sm);
  background: var(--green-soft);
  color: var(--text);
  padding: 8px 10px 8px 14px;
}

.bulk-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.publication-picker-trigger {
  max-width: 210px;
}
.publication-picker {
  width: min(330px, calc(100vw - 34px));
  max-height: min(430px, 70vh);
  overflow-y: auto;
  display: grid;
  gap: 7px;
  padding: 10px;
}
.publication-picker > strong {
  font-size: 12px;
}
.publication-picker > p {
  margin: 0;
  color: var(--text-sub);
  font-size: 12px;
}

.required-marker {
  color: var(--red);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.table-card {
  max-height: calc(100vh - 220px);
  overflow: auto;
}

.product-workspace {
  display: block;
  min-width: 0;
}
.load-more-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 0 0;
  color: var(--text-sub);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.products-table {
  width: 100%;
  min-width: 720px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  text-align: left;
}
.products-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  background: var(--surface-soft);
  border-bottom: 1px solid var(--border);
}
.products-table td {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  overflow-wrap: anywhere;
}

.products-table .selection-column {
  width: 48px;
  padding-inline: 16px 4px;
}

.products-table th:nth-child(2) {
  width: 38%;
}

.products-table th:nth-child(3) {
  width: 14%;
}

.products-table th:nth-child(4) {
  width: 9%;
}

.products-table th:nth-child(5),
.products-table th:nth-child(6) {
  width: 12%;
}

.products-table th:nth-child(7) {
  width: 10%;
}

.product-row:hover {
  background: var(--surface-soft);
}
.product-row {
  cursor: pointer;
}
.product-row.selected,
.product-row.selected:hover {
  background: var(--blue-soft);
}

.product-row.is-bulk-selected,
.product-row.is-bulk-selected:hover {
  background: color-mix(in srgb, var(--green-soft) 72%, var(--surface));
}

.product-row.selected.is-bulk-selected,
.product-row.selected.is-bulk-selected:hover {
  background: color-mix(in srgb, var(--blue-soft) 55%, var(--green-soft));
}

.product-info-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.product-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid var(--border);
}
.empty-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-soft);
  color: var(--text-muted);
  font-size: 10px;
  text-align: center;
}
.product-main-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.product-title-text {
  font-weight: 600;
  color: var(--text);
  overflow-wrap: anywhere;
}
.product-id-sub {
  font-size: 11px;
  color: var(--text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-mobile-facts {
  display: none;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
}

.virtual-spacer td {
  padding: 0;
  border: 0;
}

.page-meta-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-state {
  color: var(--red);
}
.badge::before {
  content: "•";
  font-size: 14px;
}
.badge-paid {
  background: var(--badge-paid);
  color: var(--badge-paid-text);
}
.badge-pending {
  background: var(--badge-pending);
  color: var(--badge-pending-text);
}

.product-status-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.publication-state {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.publication-state.published {
  color: var(--green);
}

.popover-item :deep(svg),
.modal-actions button :deep(svg) {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.popover-actions {
  min-width: 120px;
  padding: 4px;
}
.popover-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text);
  font-family: inherit;
}
.popover-item:disabled {
  cursor: wait;
  opacity: 0.55;
}
.popover-item:hover {
  background: var(--surface-soft);
}
.text-danger {
  color: var(--badge-cancelled-text) !important;
}
.product-actions-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-sub);
}
#loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 60px 20px;
  color: var(--text-sub);
}

.loading-icon {
  width: 17px;
  height: 17px;
  animation: product-loading-spin 0.8s linear infinite;
}

@keyframes product-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--dialog-backdrop);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: var(--surface);
  width: 100%;
  max-width: 680px;
  border: 1px solid var(--border);
  border-radius: var(--dialog-radius);
  box-shadow: var(--dialog-shadow);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  max-width: min(680px, calc(100vw - 28px));
  min-width: 0;
}
.product-edit-modal {
  height: min(820px, calc(100dvh - 28px));
  max-width: min(1120px, calc(100vw - 28px));
}
.product-edit-modal .inp:not(textarea) {
  height: var(--control-height-md);
  min-height: var(--control-height-md);
  padding-block: 0;
}
.product-edit-modal :deep(.product-form-select .select-trigger),
.product-edit-modal :deep(.base-checkbox) {
  height: var(--control-height-md);
  min-height: var(--control-height-md);
}
.product-identity-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
}
.product-status-field {
  width: fit-content;
  max-width: 100%;
}
.product-status-controls {
  width: fit-content;
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}
.product-status-controls :deep(.product-status-select) {
  width: 150px;
  flex: 0 0 150px;
}
.product-status-controls :deep(.base-checkbox) {
  width: fit-content;
}
.product-edit-nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}
.product-edit-nav-button {
  width: 100%;
  min-width: 0;
  border-radius: var(--control-radius);
  color: var(--text-sub);
}
.product-edit-nav-button:hover {
  background: var(--surface-raised);
  color: var(--text);
}
.product-edit-nav-button.is-active {
  border-color: var(--border);
  background: var(--surface-raised);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.product-edit-nav-button :deep(svg) {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}
.product-edit-nav-button :deep(.button-label) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.modal-body.product-catalog-body {
  padding: 0;
}
.product-catalog-editor {
  min-width: 0;
  display: grid;
}

.product-catalog-editor > :deep(.product-media-manager) {
  padding: 16px;
  border-top: 1px solid var(--border);
}
.product-edit-loading,
.product-edit-error {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 24px;
  color: var(--text-sub);
  font-size: 12px;
  text-align: center;
}
.product-edit-error {
  flex-direction: column;
  color: var(--red);
}
.duplicate-modal {
  max-width: min(520px, calc(100vw - 28px));
}
.option-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.option-row {
  display: grid;
  grid-template-columns: minmax(130px, 1fr) minmax(220px, 2fr) auto;
  gap: 8px;
  margin-top: 8px;
}
.modal-head {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.modal-body {
  min-height: 0;
  flex: 1 1 auto;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
}
.field {
  margin-bottom: 16px;
}
.field-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.field-row .field {
  flex: 1;
  margin-bottom: 0;
}
.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 26px;
  cursor: pointer;
}
.checkbox-field input {
  width: 16px;
  height: 16px;
}
.checkbox-field:has(input:disabled) {
  color: var(--text-muted);
  cursor: not-allowed;
}
.edit-checkbox-field :deep(.base-checkbox),
.compact-checkbox :deep(.base-checkbox) {
  width: 100%;
}
.field-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
  color: var(--text);
}
.field > small,
.advanced-product-fields small {
  display: block;
  margin-top: 5px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
}
.advanced-product-fields {
  min-width: 0;
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-low);
}
.advanced-product-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.advanced-product-heading strong {
  font-size: 13px;
}
.advanced-product-heading p,
.modal-head p {
  margin: 3px 0 0;
  color: var(--text-sub);
  font-size: 11px;
}
.product-commerce-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(280px, 1fr) fit-content(460px);
  gap: 12px;
  align-items: start;
}
.product-commerce-row .field {
  margin-bottom: 0;
}
.product-collections-field {
  width: fit-content;
  max-width: min(460px, 45vw);
}
.product-readonly-facts > div {
  min-width: 0;
  display: grid;
  gap: 4px;
  align-content: center;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface-raised);
}
.product-readonly-facts span {
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
}
.compact-checkbox {
  padding-top: 0;
}
.product-collection-picker {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 2px;
}
.product-form-empty {
  padding: 16px;
  border: 1px dashed var(--border);
  border-radius: 7px;
  color: var(--text-sub);
  font-size: 12px;
  text-align: center;
}
.product-plan-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.product-plan-chips span {
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--blue-soft);
  color: var(--text);
  font-size: 11px;
  overflow-wrap: anywhere;
}
.inp {
  width: 100%;
  min-height: var(--control-height-md);
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--control-radius);
  font-family: inherit;
  font-size: 14px;
}
.inp:focus {
  border-color: var(--green);
  outline: none;
  box-shadow: var(--focus-ring);
}
.modal-actions {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 700px) {
  .page-meta-header,
  .bulk-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .page-meta-actions,
  .bulk-toolbar-actions {
    justify-content: flex-start;
  }

  .field-row {
    flex-direction: column;
  }

  .product-identity-row {
    grid-template-columns: 1fr;
  }

  .product-status-field,
  .product-status-controls,
  .product-collections-field {
    width: 100%;
    max-width: none;
  }

  .product-status-controls {
    flex-wrap: wrap;
  }

  .product-commerce-row {
    grid-template-columns: 1fr;
  }

  .products-tab :deep(.payment-filter-fields),
  .option-row {
    grid-template-columns: 1fr;
  }

  .product-date-filters {
    grid-column: 1;
  }

  .product-collection-picker {
    flex-direction: column;
  }

  .modal-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .modal-card,
  .duplicate-modal {
    width: 100%;
    max-width: none;
    max-height: 94dvh;
    border-radius: 14px 14px 0 0;
  }

  .product-edit-modal {
    height: 94dvh;
    max-width: none;
  }

  .product-edit-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-inline: 12px;
  }

  .modal-actions {
    flex-wrap: wrap;
  }

  .modal-actions button {
    flex: 1 1 140px;
    justify-content: center;
  }

  .checkbox-field {
    padding-top: 0;
  }

  .table-card {
    max-height: calc(100dvh - 190px);
  }

  .products-table {
    min-width: 0;
  }

  .products-table th,
  .products-table td {
    padding: 12px 8px;
  }

  .products-table .selection-column {
    width: 38px;
    padding-inline: 10px 2px;
  }

  .products-table th:nth-child(2) {
    width: auto;
  }

  .products-table th:nth-child(3) {
    width: 96px;
  }

  .products-table th:nth-child(4),
  .products-table th:nth-child(5),
  .products-table th:nth-child(6),
  .products-table td:nth-child(4),
  .products-table td:nth-child(5),
  .products-table td:nth-child(6) {
    display: none;
  }

  .products-table th:nth-child(7) {
    width: 44px;
  }

  .product-info-cell {
    gap: 8px;
  }

  .product-thumb {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
  }

  .product-id-sub {
    display: none;
  }

  .product-mobile-facts {
    min-width: 0;
    display: flex;
    gap: 5px;
    color: var(--text-muted);
    font-size: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .product-mobile-facts span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .product-status-cell {
    min-width: 0;
  }

  .publication-state {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .load-more-row {
    flex-wrap: wrap;
  }
}
</style>
