import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { getCurrentLanguage } from '../i18n/TranslationProvider'
import { translateAccountName, translateAlias } from '../i18n/accountNames'
import { usePermissions } from '../hooks/usePermissions'
import { useConfig } from '../hooks/useConfig'
import { EntitySelector } from '../components/EntitySelector'
import { Plus, Check, X, HelpCircle, Users, Calendar, Shield, Vote as VoteIcon, DollarSign, Crown, Trash2, FileText, Clock, Building2, Search, KeyRound, Pencil } from 'lucide-react'
import { fmtTQ, fmtDateTime, fmtNumber } from '../lib/format'

type ProposalType =
  | 'limit_change' | 'admission' | 'expulsion' | 'budget_increase'
  | 'federation_config' | 'recovery_config' | 'tax_change' | 'member_level' | 'policy'
  | 'create_account' | 'fund_distribution' | 'energy_rate_change' | 'product_modification' | 'free_proposal'
  | 'budget' | 'election' | 'product_approval' | 'product_disapproval' | 'product_remove' | 'product_import' | 'product_to_base' | 'federation'
  | 'node_config' | 'backup_config' | 'cluster_config' | 'permission_assignment' | 'federation_treaty'

const PROPOSAL_LABEL_KEYS: Record<string, string> = {
  limit_change: 'proposal_type.limit_change',
  admission: 'proposal_type.admission',
  expulsion: 'proposal_type.expulsion',
  budget_increase: 'proposal_type.budget_increase',
  federation_config: 'proposal_type.federation_config',
  recovery_config: 'proposal_type.recovery_config',
  tax_change: 'proposal_type.tax_change',
  member_level: 'proposal_type.member_level',
  policy: 'proposal_type.policy',
  create_account: 'proposal_type.create_account',
  fund_distribution: 'proposal_type.fund_distribution',
  energy_rate_change: 'proposal_type.energy_rate_change',
  product_modification: 'proposal_type.product_modification',
  free_proposal: 'proposal_type.free_proposal',
  budget: 'proposal_type.budget',
  election: 'proposal_type.election',
  product_approval: 'proposal_type.product_approval',
  product_disapproval: 'proposal_type.product_disapproval',
  product_remove: 'proposal_type.product_remove',
  product_import: 'proposal_type.product_import',
  product_to_base: 'proposal_type.product_to_base',
  federation: 'proposal_type.federation',
  node_config: 'proposal_type.node_config',
  backup_config: 'proposal_type.backup_config',
  cluster_config: 'proposal_type.cluster_config',
  permission_assignment: 'proposal_type.permission_assignment',
  federation_treaty: 'proposal_type.federation_treaty',
}

const PROPOSAL_HELP_KEYS: Record<string, string> = {
  limit_change: 'proposal_help.limit_change',
  admission: 'proposal_help.admission',
  expulsion: 'proposal_help.expulsion',
  budget_increase: 'proposal_help.budget_increase',
  federation_config: 'proposal_help.federation_config',
  recovery_config: 'proposal_help.recovery_config',
  tax_change: 'proposal_help.tax_change',
  member_level: 'proposal_help.member_level',
  policy: 'proposal_help.policy',
  create_account: 'proposal_help.create_account',
  fund_distribution: 'proposal_help.fund_distribution',
  energy_rate_change: 'proposal_help.energy_rate_change',
  product_modification: 'proposal_help.product_modification',
  product_approval: 'proposal_help.product_approval',
  product_disapproval: 'proposal_help.product_disapproval',
  product_remove: 'proposal_help.product_remove',
  product_import: 'proposal_help.product_import',
  product_to_base: 'proposal_help.product_to_base',
  free_proposal: 'proposal_help.free_proposal',
}

type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'entity' | 'entity_toggle'

interface EntityMode {
  key: string
  label: string
  endpoint: string
  valueKey: string
  labelKey: string
  subLabelKey?: string
  filterFn?: (item: any) => boolean
  emptyMessage?: string
}

interface ProposalField {
  key: string
  label: string
  help: string
  placeholder?: string
  type: FieldType
  options?: { value: string; label: string }[]
  endpoint?: string
  valueKey?: string
  labelKey?: string
  subLabelKey?: string
  filterFn?: (item: any) => boolean
  emptyMessage?: string
  entityModes?: EntityMode[]
}

const APPROVAL_MODE_OPTIONS = (t: any) => [
  { value: 'assembly', label: t('assembly:opt_assembly') },
  { value: 'council', label: t('assembly:opt_council') },
  { value: 'multi_sig', label: t('assembly:opt_multi_sig') },
]

const ACCOUNT_TYPE_OPTIONS = (t: any) => [
  { value: 'asset', label: t('assembly:opt_asset') },
  { value: 'liability', label: t('assembly:opt_liability') },
  { value: 'equity', label: t('assembly:opt_equity') },
  { value: 'income', label: t('assembly:opt_income') },
  { value: 'expense', label: t('assembly:opt_expense') },
]

const ENERGY_PARAM_OPTIONS = (t: any) => [
  { value: 'kwh_price', label: t('assembly:opt_kwh_price') },
  { value: 'base_fee', label: t('assembly:opt_base_fee') },
  { value: 'connection_fee', label: t('assembly:opt_connection_fee') },
  { value: 'minimum_charge', label: t('assembly:opt_minimum_charge') },
]

const FREE_CATEGORY_OPTIONS = (t: any) => [
  { value: 'social', label: t('assembly:opt_social') },
  { value: 'economic', label: t('assembly:opt_economic') },
  { value: 'governance', label: t('assembly:opt_governance') },
  { value: 'technical', label: t('assembly:opt_technical') },
  { value: 'other', label: t('assembly:opt_other') },
]

const TAX_APPLIES_OPTIONS = (t: any) => [
  { value: 'all', label: t('assembly:opt_tax_all') },
  { value: 'member_level', label: t('assembly:opt_tax_member') },
  { value: 'org_level', label: t('assembly:opt_tax_org') },
]

const BACKUP_ENABLED_OPTIONS = (t: any) => [
  { value: 'true', label: t('assembly:opt_yes') },
  { value: 'false', label: t('assembly:opt_no') },
]

const CLUSTER_MODE_OPTIONS = (t: any) => [
  { value: 'distributed', label: t('assembly:opt_distributed') },
  { value: 'clustered', label: t('assembly:opt_clustered') },
]

const PERMISSION_ACTION_OPTIONS = (t: any) => [
  { value: 'assign', label: t('assembly:opt_assign') },
  { value: 'revoke', label: t('assembly:opt_revoke') },
]

const TREATY_ACTION_OPTIONS = (t: any) => [
  { value: 'sign', label: t('assembly:opt_sign') },
  { value: 'revoke', label: t('assembly:opt_revoke_treaty') },
]

const BOARD_POSITIONS = (t: any) => [
  { value: 'presidente', label: t('assembly:board_president') },
  { value: 'vicepresidente', label: t('assembly:board_vice_president') },
  { value: 'secretario', label: t('assembly:board_secretary') },
  { value: 'tesorero', label: t('assembly:board_treasurer') },
  { value: 'vocal', label: t('assembly:board_vocal') },
  { value: 'fiscal', label: t('assembly:board_fiscal') },
]

const PROPOSAL_FIELDS = (currency: string, t: any): Record<ProposalType, ProposalField[]> => ({
  limit_change: [
    {
      key: 'usuario_organizacion',
      label: t('assembly:pf_user_or_org'),
      help: t('assembly:pf_user_or_org_help'),
      placeholder: t('assembly:pf_example_maria'),
      type: 'entity_toggle',
      entityModes: [
        { key: 'user', label: t('assembly:pf_search_user'), endpoint: '/accounts/search', valueKey: 'username', labelKey: 'username', subLabelKey: 'display_name', emptyMessage: t('assembly:pf_no_users_found') },
        { key: 'org', label: t('assembly:pf_search_org'), endpoint: '/organizations', valueKey: 'name', labelKey: 'name', subLabelKey: 'description', emptyMessage: t('assembly:pf_no_orgs_found') },
      ],
    },
    { key: 'nuevo_limite_credito', label: t('assembly:pf_new_credit_limit', { currency }), help: t('assembly:pf_new_credit_limit_help', { currency }), placeholder: '200', type: 'number' },
    { key: 'nuevo_limite_debito', label: t('assembly:pf_new_debit_limit', { currency }), help: t('assembly:pf_new_debit_limit_help', { currency }), placeholder: '200', type: 'number' },
  ],
  admission: [
    {
      key: 'usuario',
      label: t('assembly:pf_user_to_admit'),
      help: t('assembly:pf_user_to_admit_help'),
      placeholder: t('assembly:pf_example_new_member'),
      type: 'entity',
      endpoint: '/accounts/search',
      valueKey: 'username',
      labelKey: 'username',
      subLabelKey: 'display_name',
      emptyMessage: t('assembly:pf_no_users_found'),
    },
    {
      key: 'nivel',
      label: t('assembly:pf_level'),
      help: t('assembly:pf_level_help'),
      placeholder: t('assembly:pf_example_pleno'),
      type: 'entity',
      endpoint: '/member-levels',
      valueKey: 'name',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: t('assembly:pf_no_levels'),
    },
  ],
  expulsion: [
    {
      key: 'usuario',
      label: t('assembly:pf_user_to_expel'),
      help: t('assembly:pf_user_to_expel_help'),
      placeholder: t('assembly:pf_example_user'),
      type: 'entity',
      endpoint: '/accounts/search',
      valueKey: 'username',
      labelKey: 'username',
      subLabelKey: 'display_name',
      emptyMessage: t('assembly:pf_no_users_found'),
    },
    { key: 'razon', label: t('assembly:pf_expulsion_reason'), help: t('assembly:pf_expulsion_reason_help'), placeholder: t('assembly:pf_expulsion_reason_ph'), type: 'textarea' },
  ],
  budget_increase: [
    {
      key: 'organizacion',
      label: t('assembly:pf_organization'),
      help: t('assembly:pf_organization_help'),
      placeholder: t('assembly:pf_example_coop_norte'),
      type: 'entity',
      endpoint: '/organizations',
      valueKey: 'name',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: t('assembly:pf_no_orgs_found'),
    },
    { key: 'monto', label: t('assembly:pf_amount', { currency }), help: t('assembly:pf_amount_help', { currency }), placeholder: '500', type: 'number' },
  ],
  federation_config: [
    {
      key: 'nodo',
      label: t('assembly:pf_federated_node'),
      help: t('assembly:pf_federated_node_help'),
      placeholder: t('assembly:pf_example_node'),
      type: 'entity',
      endpoint: '/federation/peers',
      valueKey: 'domain',
      labelKey: 'domain',
      subLabelKey: 'node_name',
      emptyMessage: t('assembly:pf_no_federated_nodes'),
    },
    { key: 'limite', label: t('assembly:pf_new_limit', { currency }), help: t('assembly:pf_new_limit_help', { currency }), placeholder: '1000', type: 'number' },
  ],
  recovery_config: [
    {
      key: 'modo',
      label: t('assembly:pf_approval_mode'),
      help: t('assembly:pf_approval_mode_help'),
      type: 'select',
      options: APPROVAL_MODE_OPTIONS(t),
    },
    { key: 'aprobaciones', label: t('assembly:pf_num_approvals'), help: t('assembly:pf_num_approvals_help'), placeholder: '3', type: 'number' },
  ],
  tax_change: [
    {
      key: 'aplica_a',
      label: t('assembly:pf_applies_to'),
      help: t('assembly:pf_applies_to_help'),
      type: 'select',
      options: TAX_APPLIES_OPTIONS(t),
    },
    {
      key: 'nivel',
      label: t('assembly:pf_member_org_level'),
      help: t('assembly:pf_member_org_level_help'),
      placeholder: t('assembly:pf_example_pleno'),
      type: 'entity',
      endpoint: '/member-levels',
      valueKey: 'name',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: t('assembly:pf_no_levels'),
    },
    { key: 'tasa', label: t('assembly:pf_tax_rate'), help: t('assembly:pf_tax_rate_help'), placeholder: '2', type: 'number' },
  ],
  member_level: [
    {
      key: 'nombre_nivel',
      label: t('assembly:pf_level_name'),
      help: t('assembly:pf_level_name_help'),
      placeholder: t('assembly:pf_example_pleno'),
      type: 'entity',
      endpoint: '/member-levels',
      valueKey: 'name',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: t('assembly:pf_no_levels_new'),
    },
    { key: 'descripcion_nivel', label: t('assembly:pf_description'), help: t('assembly:pf_description_help'), placeholder: t('assembly:pf_perms_scope'), type: 'textarea' },
    { key: 'limite_credito', label: t('assembly:pf_credit_limit', { currency }), help: t('assembly:pf_credit_limit_help', { currency }), placeholder: '500', type: 'number' },
    { key: 'limite_debito', label: t('assembly:pf_debit_limit', { currency }), help: t('assembly:pf_debit_limit_help', { currency }), placeholder: '500', type: 'number' },
  ],
  policy: [
    { key: 'detalle', label: t('assembly:pf_policy_detail'), help: t('assembly:pf_policy_detail_help'), placeholder: t('assembly:pf_decision_desc'), type: 'textarea' },
  ],
  create_account: [
    { key: 'nombre', label: t('assembly:pf_account_name'), help: t('assembly:pf_account_name_help'), placeholder: t('assembly:pf_example_fondo_social'), type: 'text' },
    {
      key: 'tipo',
      label: t('assembly:pf_account_type'),
      help: t('assembly:pf_account_type_help'),
      type: 'select',
      options: ACCOUNT_TYPE_OPTIONS(t),
    },
    { key: 'descripcion', label: t('assembly:pf_account_desc'), help: t('assembly:pf_account_desc_help'), placeholder: t('assembly:pf_account_desc_ph'), type: 'textarea' },
    {
      key: 'responsables',
      label: t('assembly:pf_account_manager'),
      help: t('assembly:pf_account_manager_help'),
      placeholder: t('assembly:pf_example_maria'),
      type: 'entity_toggle',
      entityModes: [
        { key: 'user', label: t('assembly:pf_search_user'), endpoint: '/accounts/search', valueKey: 'username', labelKey: 'username', subLabelKey: 'display_name', emptyMessage: t('assembly:pf_no_users_found') },
        { key: 'org', label: t('assembly:pf_search_org'), endpoint: '/organizations', valueKey: 'name', labelKey: 'name', subLabelKey: 'description', emptyMessage: t('assembly:pf_no_orgs_found') },
      ],
    },
  ],
  fund_distribution: [
    {
      key: 'cuenta_destino',
      label: t('assembly:pf_dest_account'),
      help: t('assembly:pf_dest_account_help'),
      placeholder: t('assembly:pf_example_coop_norte'),
      type: 'entity_toggle',
      entityModes: [
        { key: 'org', label: t('assembly:pf_search_org'), endpoint: '/organizations', valueKey: 'id', labelKey: 'display_name', subLabelKey: 'username', emptyMessage: t('assembly:pf_no_orgs_found') },
        { key: 'dept', label: t('assembly:pf_search_dept'), endpoint: '/departments', valueKey: 'id', labelKey: 'name', subLabelKey: 'description', emptyMessage: t('assembly:pf_no_depts_found') },
      ],
    },
    { key: 'monto', label: t('assembly:pf_amount', { currency }), help: t('assembly:pf_distribute_amount_help', { currency }), placeholder: '200', type: 'number' },
    { key: 'razon', label: t('assembly:pf_reason'), help: t('assembly:pf_distribute_reason_help'), placeholder: t('assembly:pf_distribute_reason_ph'), type: 'textarea' },
  ],
  energy_rate_change: [
    {
      key: 'parametro',
      label: t('assembly:pf_param_change'),
      help: t('assembly:pf_param_change_help'),
      type: 'select',
      options: ENERGY_PARAM_OPTIONS(t),
    },
    { key: 'nuevo_valor', label: t('assembly:pf_new_value'), help: t('assembly:pf_new_value_help'), placeholder: '0.15', type: 'number' },
  ],
  product_modification: [
    {
      key: 'producto',
      label: t('assembly:pf_product'),
      help: t('assembly:pf_product_help'),
      placeholder: t('assembly:pf_search_product'),
      type: 'entity',
      endpoint: '/products',
      valueKey: 'id',
      labelKey: 'name',
      subLabelKey: 'category',
      emptyMessage: t('assembly:pf_no_products'),
    },
    { key: 'nuevo_precio', label: t('assembly:pf_new_price', { currency }), help: t('assembly:pf_new_price_help', { currency }), placeholder: '5', type: 'number' },
    { key: 'razon', label: t('assembly:pf_reason'), help: t('assembly:pf_price_change_reason_help'), placeholder: t('assembly:pf_change_reason_ph'), type: 'textarea' },
  ],
  free_proposal: [
    { key: 'titulo', label: t('assembly:pf_title'), help: t('assembly:pf_title_help'), placeholder: t('assembly:pf_example_title'), type: 'text' },
    { key: 'descripcion', label: t('assembly:pf_detailed_desc'), help: t('assembly:pf_detailed_desc_help'), placeholder: t('assembly:pf_full_desc_ph'), type: 'textarea' },
    {
      key: 'categoria',
      label: t('assembly:pf_category'),
      help: t('assembly:pf_category_help'),
      type: 'select',
      options: FREE_CATEGORY_OPTIONS(t),
    },
    { key: 'subcategoria', label: t('assembly:pf_subcategory'), help: t('assembly:pf_subcategory_help'), placeholder: t('assembly:pf_example_subcat'), type: 'text' },
  ],
  product_approval: [
    {
      key: 'product_id',
      label: t('assembly:pf_product'),
      help: t('assembly:pf_product_help'),
      placeholder: t('assembly:pf_search_product'),
      type: 'entity',
      endpoint: '/products',
      valueKey: 'id',
      labelKey: 'name',
      subLabelKey: 'category',
      emptyMessage: t('assembly:pf_no_products'),
    },
  ],
  product_disapproval: [
    {
      key: 'product_id',
      label: t('assembly:pf_product'),
      help: t('assembly:pf_product_help'),
      placeholder: t('assembly:pf_search_product'),
      type: 'entity',
      endpoint: '/products',
      valueKey: 'id',
      labelKey: 'name',
      subLabelKey: 'category',
      emptyMessage: t('assembly:pf_no_products'),
    },
    { key: 'razon', label: t('assembly:pf_reason'), help: t('assembly:pf_disapproval_reason_help'), placeholder: t('assembly:pf_change_reason_ph'), type: 'textarea' },
  ],
  product_remove: [
    {
      key: 'product_id',
      label: t('assembly:pf_product'),
      help: t('assembly:pf_product_help'),
      placeholder: t('assembly:pf_search_product'),
      type: 'entity',
      endpoint: '/products',
      valueKey: 'id',
      labelKey: 'name',
      subLabelKey: 'category',
      emptyMessage: t('assembly:pf_no_products'),
    },
    { key: 'razon', label: t('assembly:pf_reason'), help: t('assembly:pf_remove_reason_help'), placeholder: t('assembly:pf_change_reason_ph'), type: 'textarea' },
  ],
  product_import: [
    { key: 'product_name', label: t('assembly:pf_product_name'), help: t('assembly:pf_product_name_help'), placeholder: t('assembly:pf_example_product_name'), type: 'text' },
    { key: 'source_node', label: t('assembly:pf_source_node'), help: t('assembly:pf_source_node_help'), placeholder: t('assembly:pf_example_node'), type: 'text' },
    { key: 'source_product_id', label: t('assembly:pf_source_product_id'), help: t('assembly:pf_source_product_id_help'), placeholder: 'uuid', type: 'text' },
    { key: 'category', label: t('assembly:pf_parent_category'), help: t('assembly:pf_parent_category_help'), placeholder: t('assembly:pf_example_category'), type: 'text' },
    { key: 'subcategory', label: t('assembly:pf_subcategory'), help: t('assembly:pf_subcategory_help'), placeholder: t('assembly:pf_example_subcat'), type: 'text' },
    { key: 'price', label: t('assembly:pf_new_price', { currency }), help: t('assembly:pf_new_price_help', { currency }), placeholder: '5', type: 'number' },
    { key: 'image_url', label: t('assembly:pf_image_url'), help: t('assembly:pf_image_url_help'), placeholder: 'https://...', type: 'text' },
  ],
  product_to_base: [
    {
      key: 'product_id',
      label: t('assembly:pf_product'),
      help: t('assembly:pf_product_help'),
      placeholder: t('assembly:pf_search_product'),
      type: 'entity',
      endpoint: '/products',
      valueKey: 'id',
      labelKey: 'name',
      subLabelKey: 'category',
      emptyMessage: t('assembly:pf_no_products'),
    },
    { key: 'razon', label: t('assembly:pf_reason'), help: t('assembly:pf_to_base_reason_help'), placeholder: t('assembly:pf_change_reason_ph'), type: 'textarea' },
  ],
  node_config: [
    { key: 'node_name', label: t('assembly:pf_node_name'), help: t('assembly:pf_node_name_help'), placeholder: t('assembly:pf_example_node_name'), type: 'text' },
    { key: 'currency_name', label: t('assembly:pf_currency_name'), help: t('assembly:pf_currency_name_help'), placeholder: 'TQ', type: 'text' },
    { key: 'currency_full_name', label: t('assembly:pf_currency_full_name'), help: t('assembly:pf_currency_full_name_help'), placeholder: t('assembly:pf_example_currency_full'), type: 'text' },
    { key: 'app_name', label: t('assembly:pf_app_name'), help: t('assembly:pf_app_name_help'), placeholder: t('assembly:pf_example_app_name'), type: 'text' },
  ],
  backup_config: [
    { key: 'interval_hours', label: t('assembly:pf_interval_hours'), help: t('assembly:pf_interval_hours_help'), placeholder: '24', type: 'number' },
    { key: 'retention_days', label: t('assembly:pf_retention_days'), help: t('assembly:pf_retention_days_help'), placeholder: '30', type: 'number' },
    {
      key: 'enabled',
      label: t('assembly:pf_enabled'),
      help: t('assembly:pf_enabled_help'),
      type: 'select',
      options: BACKUP_ENABLED_OPTIONS(t),
    },
  ],
  cluster_config: [
    {
      key: 'mode',
      label: t('assembly:pf_cluster_mode'),
      help: t('assembly:pf_cluster_mode_help'),
      type: 'select',
      options: CLUSTER_MODE_OPTIONS(t),
    },
    { key: 'tablet_limit', label: t('assembly:pf_tablet_limit'), help: t('assembly:pf_tablet_limit_help'), placeholder: '1000', type: 'number' },
    { key: 'min_nodes', label: t('assembly:pf_min_nodes'), help: t('assembly:pf_min_nodes_help'), placeholder: '3', type: 'number' },
    { key: 'alert_threshold', label: t('assembly:pf_alert_threshold'), help: t('assembly:pf_alert_threshold_help'), placeholder: '80', type: 'number' },
  ],
  permission_assignment: [
    {
      key: 'user_id',
      label: t('assembly:pf_user_to_assign'),
      help: t('assembly:pf_user_to_assign_help'),
      placeholder: t('assembly:pf_example_maria'),
      type: 'entity',
      endpoint: '/accounts/search',
      valueKey: 'id',
      labelKey: 'username',
      subLabelKey: 'display_name',
      emptyMessage: t('assembly:pf_no_users_found'),
    },
    {
      key: 'level_id',
      label: t('assembly:pf_level'),
      help: t('assembly:pf_level_help'),
      placeholder: t('assembly:pf_example_pleno'),
      type: 'entity',
      endpoint: '/member-levels',
      valueKey: 'id',
      labelKey: 'name',
      subLabelKey: 'description',
      emptyMessage: t('assembly:pf_no_levels'),
    },
    {
      key: 'action',
      label: t('assembly:pf_action'),
      help: t('assembly:pf_action_help'),
      type: 'select',
      options: PERMISSION_ACTION_OPTIONS(t),
    },
  ],
  federation_treaty: [
    {
      key: 'other_node_domain',
      label: t('assembly:pf_other_node'),
      help: t('assembly:pf_other_node_help'),
      placeholder: t('assembly:pf_example_node'),
      type: 'entity',
      endpoint: '/federation/peers',
      valueKey: 'domain',
      labelKey: 'domain',
      subLabelKey: 'node_name',
      emptyMessage: t('assembly:pf_no_federated_nodes'),
    },
    {
      key: 'action',
      label: t('assembly:pf_action'),
      help: t('assembly:pf_treaty_action_help'),
      type: 'select',
      options: TREATY_ACTION_OPTIONS(t),
    },
  ],
  budget: [
    {
      key: 'cuenta_origen',
      label: t('assembly:pf_source_account'),
      help: t('assembly:pf_source_account_help'),
      placeholder: t('assembly:pf_example_coop_norte'),
      type: 'entity_toggle',
      entityModes: [
        { key: 'org', label: t('assembly:pf_search_org'), endpoint: '/organizations', valueKey: 'id', labelKey: 'display_name', subLabelKey: 'username', emptyMessage: t('assembly:pf_no_orgs_found') },
        { key: 'dept', label: t('assembly:pf_search_dept'), endpoint: '/departments', valueKey: 'id', labelKey: 'name', subLabelKey: 'description', emptyMessage: t('assembly:pf_no_depts_found') },
      ],
    },
    { key: 'monto', label: t('assembly:pf_amount', { currency }), help: t('assembly:pf_amount_help', { currency }), placeholder: '500', type: 'number' },
    { key: 'razon', label: t('assembly:pf_reason'), help: t('assembly:pf_budget_reason_help'), placeholder: t('assembly:pf_distribute_reason_ph'), type: 'textarea' },
  ],
  election: [
    {
      key: 'cargo',
      label: t('assembly:pf_board_position'),
      help: t('assembly:pf_board_position_help'),
      type: 'select',
      options: BOARD_POSITIONS(t),
    },
    { key: 'razon', label: t('assembly:pf_reason'), help: t('assembly:pf_election_reason_help'), placeholder: t('assembly:pf_distribute_reason_ph'), type: 'textarea' },
  ],
  federation: [
    {
      key: 'nodo',
      label: t('assembly:pf_federated_node'),
      help: t('assembly:pf_federated_node_help'),
      placeholder: t('assembly:pf_example_node'),
      type: 'entity',
      endpoint: '/federation/peers',
      valueKey: 'domain',
      labelKey: 'domain',
      subLabelKey: 'node_name',
      emptyMessage: t('assembly:pf_no_federated_nodes'),
    },
    { key: 'razon', label: t('assembly:pf_reason'), help: t('assembly:pf_federation_reason_help'), placeholder: t('assembly:pf_distribute_reason_ph'), type: 'textarea' },
  ],
})

// Componente reutilizable para lista de departamentos con gestion de roles
function DeptListWithRoles({
  depts, expandedDept, setExpandedDept,
  deptRoles, setDeptRoles,
  deptMembers, setDeptMembers,
  showCreateRole, setShowCreateRole,
  showAssignMember, setShowAssignMember,
  newRole, setNewRole,
  newMember, setNewMember,
  allPerms, allMembers,
  rolePermsList, setRolePermsList,
  showRolePerms, setShowRolePerms,
  canManage,
}: {
  depts: any[]
  expandedDept: string | null
  setExpandedDept: (s: string | null) => void
  deptRoles: any[]
  setDeptRoles: (r: any[]) => void
  deptMembers: any[]
  setDeptMembers: (m: any[]) => void
  showCreateRole: string | null
  setShowCreateRole: (s: string | null) => void
  showAssignMember: string | null
  setShowAssignMember: (s: string | null) => void
  newRole: { name: string, description: string }
  setNewRole: (r: { name: string, description: string }) => void
  newMember: { user_id: string, role_id: string }
  setNewMember: (m: { user_id: string, role_id: string }) => void
  allPerms: any[]
  allMembers: any[]
  rolePermsList: any[]
  setRolePermsList: (p: any[]) => void
  showRolePerms: string | null
  setShowRolePerms: (s: string | null) => void
  canManage: boolean
}) {
  const { t } = useTranslation(['assembly', 'common'])
  const loadRoles = async (deptId: string) => {
    try {
      const res = await api.get<any[]>(`/departments/${deptId}/roles`)
      setDeptRoles(res || [])
    } catch { setDeptRoles([]) }
  }

  const loadMembers = async (deptId: string) => {
    try {
      const res = await api.get<any[]>(`/departments/${deptId}/members`)
      setDeptMembers(res || [])
    } catch { setDeptMembers([]) }
  }

  const loadRolePerms = async (roleId: string) => {
    try {
      const res = await api.get<any[]>(`/roles/${roleId}/permissions`)
      setRolePermsList(res || [])
    } catch { setRolePermsList([]) }
  }

  const createRole = async (deptId: string) => {
    if (!newRole.name) return
    try {
      await api.post(`/departments/${deptId}/roles`, newRole)
      setShowCreateRole(null)
      setNewRole({ name: '', description: '' })
      loadRoles(deptId)
    } catch (e: any) {
      alert(e?.message || t('assembly:error_create_role'))
    }
  }

  const assignMember = async (deptId: string) => {
    if (!newMember.user_id || !newMember.role_id) return
    try {
      await api.post(`/departments/${deptId}/members`, newMember)
      setShowAssignMember(null)
      setNewMember({ user_id: '', role_id: '' })
      loadMembers(deptId)
    } catch (e: any) {
      alert(e?.message || t('error_assign_member'))
    }
  }

  const toggleRolePerm = async (roleId: string, permId: string, has: boolean) => {
    try {
      if (has) {
        // Quitar: enviar lista sin ese permiso
        const current = rolePermsList.map((p: any) => p.id)
        await api.put(`/roles/${roleId}/permissions`, { permission_ids: current.filter((id: string) => id !== permId) })
      } else {
        // Agregar: enviar lista con ese permiso
        const current = rolePermsList.map((p: any) => p.id)
        await api.put(`/roles/${roleId}/permissions`, { permission_ids: [...current, permId] })
      }
      loadRolePerms(roleId)
    } catch (e: any) {
      alert(e?.message || t('error_change_perm'))
    }
  }

  const removeMember = async (deptId: string, userId: string) => {
    try {
      await api.delete(`/departments/${deptId}/members/${userId}`)
      loadMembers(deptId)
    } catch (e: any) {
      alert(e?.message || t('common:error_generic'))
    }
  }

  if (depts.length === 0) {
    return <p className="text-sm text-gray-500 py-4">{t('assembly_no_depts')}</p>
  }

  return (
    <div className="space-y-2">
      {depts.map((d: any) => (
        <div key={d.id} className="border rounded-lg overflow-hidden">
          {/* Header del departamento */}
          <div
            className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
            onClick={() => {
              if (expandedDept === d.id) {
                setExpandedDept(null)
              } else {
                setExpandedDept(d.id)
                loadRoles(d.id)
                loadMembers(d.id)
                setShowCreateRole(null)
                setShowAssignMember(null)
                setShowRolePerms(null)
              }
            }}
          >
            <div>
              <span className="font-medium text-sm">{d.name}</span>
              {d.description && <span className="text-xs text-gray-500 ml-2">- {d.description}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{d.group_type}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {d.is_active ? t('assembly_active', 'Activo') : t('assembly_inactive', 'Inactivo')}
              </span>
              <span className="text-gray-400 text-xs">{expandedDept === d.id ? '▼' : '▶'}</span>
            </div>
          </div>

          {/* Contenido expandido: roles + miembros */}
          {expandedDept === d.id && (
            <div className="p-3 bg-white space-y-3">
              {/* Roles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{t('assembly_roles')}</h4>
                  {canManage && (
                    <button
                      onClick={() => { setShowCreateRole(showCreateRole === d.id ? null : d.id); setShowRolePerms(null); setShowAssignMember(null) }}
                      className="text-xs text-trueque-600 hover:text-trueque-700 flex items-center gap-1"
                    >
                      <Plus size={12} /> {t('assembly_new_role')}
                    </button>
                  )}
                </div>
                {deptRoles.length === 0 && <p className="text-xs text-gray-400">{t('assembly_no_roles')}</p>}
                <div className="space-y-1">
                  {deptRoles.map((role: any) => (
                    <div key={role.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                      <div>
                        <span className="font-medium text-sm">{role.name}</span>
                        {role.description && <p className="text-xs text-gray-500">{role.description}</p>}
                      </div>
                      <button
                        onClick={() => {
                          if (showRolePerms === role.id) {
                            setShowRolePerms(null)
                          } else {
                            setShowRolePerms(role.id)
                            loadRolePerms(role.id)
                          }
                        }}
                        className="text-xs text-trueque-600"
                      >
                        {t('assembly_permissions')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel de permisos del rol */}
              {showRolePerms && deptRoles.some((r: any) => r.id === showRolePerms) && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <h4 className="text-sm font-medium">{t('assembly_role_perms')} "{deptRoles.find((r: any) => r.id === showRolePerms)?.name}"</h4>
                  {/* Agrupar por categoria */}
                  {(() => {
                    const grouped: Record<string, any[]> = {}
                    allPerms.forEach((p: any) => {
                      if (!grouped[p.category]) grouped[p.category] = []
                      grouped[p.category].push(p)
                    })
                    return Object.entries(grouped).map(([cat, perms]) => (
                      <div key={cat}>
                        <p className="text-xs text-gray-500 uppercase mb-1">{cat}</p>
                        <div className="space-y-1">
                          {perms.map((perm: any) => {
                            const has = rolePermsList.some((p: any) => p.id === perm.id)
                            return (
                              <label key={perm.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={has}
                                  disabled={!canManage}
                                  onChange={() => toggleRolePerm(showRolePerms, perm.id, has)}
                                  className="accent-trueque-600"
                                />
                                <span>{perm.name}</span>
                                {perm.requires_multisig && <span className="text-amber-600">[{t('assembly_multisig', 'multisig')}]</span>}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )}

              {/* Formulario crear rol */}
              {showCreateRole === d.id && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <h4 className="text-sm font-medium">{t('assembly_new_role')}</h4>
                  <input
                    className="input"
                    placeholder={t('assembly_role_name_ph')}
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder={t('assembly_role_desc_ph')}
                    value={newRole.description}
                    onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  />
                  <button onClick={() => createRole(d.id)} className="btn-primary text-sm">{t('assembly_create_role')}</button>
                </div>
              )}

              {/* Miembros del departamento */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{t('assembly_members_count')} ({deptMembers.length})</h4>
                  {canManage && (
                    <button
                      onClick={() => { setShowAssignMember(showAssignMember === d.id ? null : d.id); setShowCreateRole(null); setShowRolePerms(null) }}
                      className="text-xs text-trueque-600 hover:text-trueque-700 flex items-center gap-1"
                    >
                      <Plus size={12} /> {t('assembly_assign_member')}
                    </button>
                  )}
                </div>
                {deptMembers.length === 0 && <p className="text-xs text-gray-400">{t('assembly_no_members')}</p>}
                <div className="space-y-1">
                  {deptMembers.map((m: any) => (
                    <div key={m.user_id || m.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                      <div>
                        <span className="text-sm font-medium">{m.display_name || m.username}</span>
                        {m.role_name && <span className="text-xs text-gray-500 ml-2">({m.role_name})</span>}
                      </div>
                      {canManage && (
                        <button
                          onClick={() => removeMember(d.id, m.user_id || m.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Formulario asignar miembro */}
              {showAssignMember === d.id && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <h4 className="text-sm font-medium">{t('assembly_assign_member')}</h4>
                  <select
                    className="input"
                    value={newMember.user_id}
                    onChange={(e) => setNewMember({ ...newMember, user_id: e.target.value })}
                  >
                    <option value="">{t('assembly_select_member')}</option>
                    {allMembers.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.display_name || m.username} (@{m.username})</option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={newMember.role_id}
                    onChange={(e) => setNewMember({ ...newMember, role_id: e.target.value })}
                  >
                    <option value="">{t('assembly_select_role')}</option>
                    {deptRoles.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button onClick={() => assignMember(d.id)} className="btn-primary text-sm">{t('assembly_assign')}</button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Componente reutilizable para buscar miembros y gestionar permisos
function MemberSearchAndPerms({
  members, memberSearch, setMemberSearch,
  selectedMember, setSelectedMember,
  memberPerms, setMemberPerms,
  allPerms, canManage, permMsg, setPermMsg, setAllMembers,
  badgeLabel, badgeColor,
}: {
  members: any[]
  memberSearch: string
  setMemberSearch: (s: string) => void
  selectedMember: any | null
  setSelectedMember: (m: any) => void
  memberPerms: string[]
  setMemberPerms: (p: string[]) => void
  allPerms: any[]
  canManage: boolean
  permMsg: { type: 'success' | 'error', text: string } | null
  setPermMsg: (m: { type: 'success' | 'error', text: string } | null) => void
  setAllMembers: (fn: (prev: any[]) => any[]) => void
  badgeLabel: string | ((m: any) => string)
  badgeColor: string | ((m: any) => string)
}) {
  const { t } = useTranslation(['assembly', 'common'])
  const getBadgeLabel = (m: any) => typeof badgeLabel === 'function' ? badgeLabel(m) : badgeLabel
  const getBadgeColor = (m: any) => typeof badgeColor === 'function' ? badgeColor(m) : badgeColor

  return (
    <>
      {/* Buscador de miembros */}
      <div className="card">
        <h3 className="font-medium mb-3 flex items-center gap-2"><Search size={16} />{t('assembly_search_members')} ({members.length})</h3>
        <input
          type="text"
          className="input mb-3"
          placeholder={t('assembly_search_ph')}
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
        />

        {members.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">{t('assembly_no_members_cat')}</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {members
              .filter((m: any) => {
                if (!memberSearch) return true
                const q = memberSearch.toLowerCase()
                return (m.username || '').toLowerCase().includes(q) ||
                       (m.display_name || '').toLowerCase().includes(q)
              })
              .map((m: any) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between p-2 rounded border cursor-pointer transition ${selectedMember?.id === m.id ? 'bg-trueque-50 border-trueque-300' : 'border-gray-200 hover:bg-gray-50'}`}
                  onClick={() => setSelectedMember(m)}
                >
                  <div>
                    <span className="font-medium text-sm">{m.display_name || m.username}</span>
                    <span className="text-xs text-gray-500 ml-2">@{m.username}</span>
                    {m.level_name && <span className="text-xs text-gray-400 ml-2">({m.level_name})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.is_super_admin && m.super_admin_enabled && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{t('assembly_super_admin')}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${getBadgeColor(m)}`}>{getBadgeLabel(m)}</span>
                    {m.permissions && m.permissions.length > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{m.permissions.length} {t('assembly_perms')}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Panel de permisos del miembro seleccionado */}
      {selectedMember && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <KeyRound size={16} />
              {t('assembly_perms_of')} {selectedMember.display_name || selectedMember.username}
            </h3>
            <button onClick={() => setSelectedMember(null)} className="text-gray-400 hover:text-gray-600 text-sm">{t('common:close')}</button>
          </div>

          {selectedMember.is_super_admin && selectedMember.super_admin_enabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              {t('assembly_super_admin_desc', 'Este usuario es Super Admin habilitado: tiene TODOS los permisos automaticamente.')}
            </div>
          )}

          {/* Permisos actuales */}
          <div>
            <h4 className="text-sm font-medium mb-2">{t('assembly_current_perms', 'Permisos actuales')} ({memberPerms.length})</h4>
            {memberPerms.length === 0 ? (
              <p className="text-sm text-gray-500">{t('assembly_no_direct_perms', 'No tiene permisos directos.')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {memberPerms.map((p: string) => (
                  <div key={p} className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1 text-xs">
                    <span className="font-medium">{p}</span>
                    {canManage && (
                      <button
                        onClick={async () => {
                          try {
                            await api.delete(`/users/${selectedMember.id}/permissions/${encodeURIComponent(p)}`)
                            setMemberPerms(memberPerms.filter(x => x !== p))
                            setPermMsg({ type: 'success', text: t('perm_removed', { perm: p }) })
                            setAllMembers((prev: any[]) => prev.map(m => m.id === selectedMember.id ? { ...m, permissions: m.permissions.filter((x: string) => x !== p) } : m))
                          } catch (e: any) {
                            setPermMsg({ type: 'error', text: e?.message || t('error_remove_perm') })
                          }
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Asignar nuevo permiso */}
          {canManage && (
            <div>
              <h4 className="text-sm font-medium mb-2">{t('assembly_assign_new_perm', 'Asignar nuevo permiso')}</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                {allPerms
                  .filter((p: any) => !memberPerms.includes(p.name))
                  .map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-1 hover:bg-gray-50 rounded">
                      <div>
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="text-xs text-gray-500 ml-2">({p.category})</span>
                        {p.requires_multisig && <span className="text-xs text-amber-600 ml-1">[{t('assembly_multisig', 'multisig')}]</span>}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/users/${selectedMember.id}/permissions/grant`, { permission_name: p.name })
                            setMemberPerms([...memberPerms, p.name])
                            setPermMsg({ type: 'success', text: t('perm_assigned', { perm: p.name }) })
                            setAllMembers((prev: any[]) => prev.map(m => m.id === selectedMember.id ? { ...m, permissions: [...(m.permissions || []), p.name] } : m))
                          } catch (e: any) {
                            setPermMsg({ type: 'error', text: e?.message || t('error_assign_perm') })
                          }
                        }}
                        className="text-xs text-trueque-600 hover:text-trueque-700 font-medium"
                      >
                        + {t('assembly_assign')}
                      </button>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {t('assembly_multisig_note', 'Los permisos marcados como [multisig] requieren votacion de la Asamblea. Al asignarlos directamente, se otorgan sin votacion (requiere permiso config.manage).')}
              </p>
            </div>
          )}

          {permMsg && (
            <div className={`text-xs p-2 rounded-lg ${permMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {permMsg.text}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default function Assembly() {
  const { t } = useTranslation(['assembly', 'common'])
  const { hasPermission, isSuperAdmin, superAdminEnabled } = usePermissions()
  const { currency } = useConfig()
  const canManageBoard = hasPermission('assembly.manage_board')
  const canManageTax = hasPermission('tax.manage')
  const canManage = hasPermission('config.manage') || hasPermission('assembly.manage')
  // El secretario o quien tenga permiso de gestion de asamblea puede aprobar propuestas
  const canApproveProposals = canManageBoard || hasPermission('assembly.manage')
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    api.get('/auth/me').then((d: any) => setCurrentUser(d)).catch(() => {})
  }, [])

  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as 'members' | 'board' | 'sessions' | 'proposals' | 'reports' | 'tax' | 'config' | 'wallet' | 'departments') || 'proposals'
  const [tab, setTab] = useState<'members' | 'board' | 'sessions' | 'proposals' | 'reports' | 'tax' | 'config' | 'wallet' | 'departments'>(initialTab)
  const changeTab = (newTab: 'members' | 'board' | 'sessions' | 'proposals' | 'reports' | 'tax' | 'config' | 'wallet' | 'departments') => {
    setTab(newTab)
    setSearchParams({ tab: newTab })
  }
  const [showHelp, setShowHelp] = useState(false)
  const [error, setError] = useState('')

  // Datos
  const [votingMembers, setVotingMembers] = useState<any[]>([])
  const [memberLevels, setMemberLevels] = useState<any[]>([])
  const [board, setBoard] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [proposals, setProposals] = useState<any[]>([])
  const [taxConfig, setTaxConfig] = useState<any>(null)
  const [taxAccount, setTaxAccount] = useState<any>(null)
  const [assemblyConfigs, setAssemblyConfigs] = useState<any[]>([])
  const [editingConfig, setEditingConfig] = useState<any>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [orgList, setOrgList] = useState<any[]>([])
  const [userList, setUserList] = useState<any[]>([])

  // Gestion de permisos de miembros (dentro de la pestaña members)
  const [memberSearch, setMemberSearch] = useState('')
  const [allMembers, setAllMembers] = useState<any[]>([])
  const [selectedMember, setSelectedMember] = useState<any | null>(null)
  const [memberPerms, setMemberPerms] = useState<string[]>([])
  const [allPerms, setAllPerms] = useState<any[]>([])
  const [permMsg, setPermMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Sub-pestanas de Miembros
  const [memberSubTab, setMemberSubTab] = useState<'voice' | 'voice_vote' | 'levels' | 'orgs'>('voice_vote')

  // Organizaciones (para gestion de permisos separada de personas)
  const [allOrgs, setAllOrgs] = useState<any[]>([])
  const [orgSearch, setOrgSearch] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null)
  const [orgPerms, setOrgPerms] = useState<string[]>([])
  const [orgPermMsg, setOrgPermMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Departamentos de la Asamblea (para la pestaña departments)
  const [allDepts, setAllDepts] = useState<any[]>([])

  // Sub-pestanas de Departamentos
  const [deptSubTab, setDeptSubTab] = useState<'assembly' | 'organizations'>('assembly')
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [deptRoles, setDeptRoles] = useState<any[]>([])
  const [deptMembers, setDeptMembers] = useState<any[]>([])
  const [showCreateRole, setShowCreateRole] = useState<string | null>(null)
  const [showAssignMember, setShowAssignMember] = useState<string | null>(null)
  const [newRole, setNewRole] = useState({ name: '', description: '' })
  const [newMember, setNewMember] = useState({ user_id: '', role_id: '' })
  const [rolePermsList, setRolePermsList] = useState<any[]>([])
  const [showRolePerms, setShowRolePerms] = useState<string | null>(null)
  const [newSignerType, setNewSignerType] = useState<'person' | 'organization'>('person')
  const [newSignerId, setNewSignerId] = useState('')
  const [fundData, setFundData] = useState<any>(null)
  const [fundTxs, setFundTxs] = useState<any[]>([])

  // Formularios
  const [showNewProposal, setShowNewProposal] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [showAddBoard, setShowAddBoard] = useState(false)
  const [proposalType, setProposalType] = useState<ProposalType>('limit_change')
  const [proposalFields, setProposalFields] = useState<Record<string, string>>({})
  const [proposalDesc, setProposalDesc] = useState('')
  const [votingDuration, setVotingDuration] = useState(1440) // 24h por defecto
  const [entityModes, setEntityModes] = useState<Record<string, string>>({})
  const [reports, setReports] = useState<any[]>([])
  const [reportsStats, setReportsStats] = useState<any>(null)
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] = useState<string | null>(null)
  const [selectedSessionForMinutes, setSelectedSessionForMinutes] = useState<string | null>(null)
  const [attendanceList, setAttendanceList] = useState<any[]>([])
  const [minutesText, setMinutesText] = useState('')
  const [minutesEditMode, setMinutesEditMode] = useState(false)
  const [quorumConfigs, setQuorumConfigs] = useState<any[]>([])
  const [quorumResult, setQuorumResult] = useState<any>(null)
  const [rescheduleSession, setRescheduleSession] = useState<any>(null)
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [freqConfig, setFreqConfig] = useState<any>({ ordinary_frequency_months: 3, preferred_day_of_month: 15, preferred_hour: 15, notification_days_before: 7, assemblies_enabled: true, attendance_window_hours: 1 })
  const [freqLoaded, setFreqLoaded] = useState(false)
  const [freqEditing, setFreqEditing] = useState(false)
  const [freqSaving, setFreqSaving] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<'upcoming' | 'past'>('upcoming')
  const [meetingType, setMeetingType] = useState<'assembly' | 'board'>('assembly')

  // Helper: ¿ya se puede registrar asistencia? (dentro de la ventana configurada)
  const attendanceWindowHours = freqConfig.attendance_window_hours || 1
  const canStartAttendance = (s: any) => {
    if (!s.start_time) return false
    const start = new Date(s.start_time).getTime()
    const windowStart = start - attendanceWindowHours * 60 * 60 * 1000
    return Date.now() >= windowStart
  }

  const [newSession, setNewSession] = useState({ session_type: 'ordinaria', title: '', description: '', is_presential: false, start_time: '' })
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState('15:00')
  const [newBoard, setNewBoard] = useState({ user_id: '', position: 'presidente' })

  const load = () => {
    api.get('/assembly/voting-members').then((d: any) => setVotingMembers(Array.isArray(d) ? d : [])).catch(() => {})
    api.get(`/member-levels?lang=${getCurrentLanguage()}`).then((d: any) => setMemberLevels(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/assembly/board').then((d: any) => setBoard(Array.isArray(d) ? d : [])).catch(() => {})
    api.get(`/assembly/sessions?filter=${sessionFilter}&meeting_type=${meetingType}`).then((d: any) => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/assembly/proposals').then((d: any) => setProposals(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/tax/config').then(setTaxConfig).catch(() => {})
    api.get('/tax/account').then(setTaxAccount).catch(() => {})
    api.get('/assembly/config').then((d: any) => setAssemblyConfigs(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/departments').then((d: any) => setDepartments(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/organizations').then((d: any) => setOrgList(Array.isArray(d) ? d : [])).catch(() => {})
    api.get('/assembly/voting-members').then((d: any) => { const arr = Array.isArray(d) ? d : (d?.users ?? d?.members ?? []); setUserList(arr) }).catch(() => {})
  }

  const loadSessions = () => {
    api.get(`/assembly/sessions?filter=${sessionFilter}&meeting_type=${meetingType}`).then((d: any) => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => {
    if (tab === 'sessions') loadSessions()
    if (tab === 'wallet') {
      api.get('/fund/balance').then((d: any) => {
        setFundData(d)
        if (d?.fund_account) {
          api.get(`/ledger/transactions?account_id=${d.fund_account}&limit=100`).then((td: any) => {
            setFundTxs(Array.isArray(td) ? td : [])
          }).catch(() => setFundTxs([]))
        }
      }).catch(() => {})
    }
    if (tab === 'members') {
      // Cargar todos los miembros del nodo (solo personas) + todos los permisos disponibles
      api.get('/users/all').then((d: any) => setAllMembers(Array.isArray(d) ? d : [])).catch(() => setAllMembers([]))
      api.get('/permissions').then((d: any) => setAllPerms(Array.isArray(d) ? d : [])).catch(() => setAllPerms([]))
      // Cargar organizaciones para la sub-pestan de organizaciones
      api.get('/organizations/all').then((d: any) => setAllOrgs(Array.isArray(d) ? d : [])).catch(() => setAllOrgs([]))
    }
    if (tab === 'departments') {
      // Cargar todos los departamentos del nodo
      api.get('/departments/all').then((d: any) => setAllDepts(Array.isArray(d) ? d : [])).catch(() => setAllDepts([]))
    }
  }, [sessionFilter, tab, meetingType])

  useEffect(() => { load(); loadFreqConfig() }, [])

  const createProposal = async () => {
    setError('')
    if (!proposalDesc) {
      setError(t('description_required', 'La descripcion es obligatoria'))
      return
    }
    try {
      await api.post('/assembly/proposals', {
        proposal_type: proposalType,
        description: proposalDesc,
        parameters: proposalFields,
      })
      setShowNewProposal(false)
      setProposalDesc('')
      setProposalFields({})
      setEntityModes({})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_create_proposal'))
    }
  }

  const vote = async (id: string, vote: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/vote`, { vote })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_vote'))
    }
  }

  const execute = async (id: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/execute`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_execute'))
    }
  }

  const [votingModal, setVotingModal] = useState<{ id: string; title: string } | null>(null)
  const [votingMode, setVotingMode] = useState<'presencial' | 'remoto'>('remoto')
  const [showProposalDetail, setShowProposalDetail] = useState<any | null>(null)

  const openVoting = async (id: string) => {
    try {
      await api.post(`/assembly/proposals/${id}/open-voting`, {
        voting_duration_minutes: votingDuration,
        voting_mode: votingMode,
      })
      setVotingModal(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_open_voting'))
    }
  }

  const loadReports = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType) params.set('type', filterType)
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) params.set('to', filterTo)
      if (filterStatus) params.set('status', filterStatus)
      const query = params.toString() ? `?${params.toString()}` : ''
      const data: any = await api.get(`/assembly/reports${query}`)
      setReports(data.reports || [])
      setReportsStats({
        total_proposals: data.total_proposals,
        approved: data.approved,
        rejected: data.rejected,
        expired: data.expired,
        pending: data.pending,
        avg_participation: data.avg_participation,
        total_voting_members: data.total_voting_members,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_load_reports'))
    }
  }

  const loadReportDetail = async (id: string) => {
    try {
      const data: any = await api.get(`/assembly/proposals/${id}/report`)
      setSelectedReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_load_report'))
    }
  }

  const loadAttendance = async (sessionId: string) => {
    try {
      const data: any = await api.get(`/assembly/sessions/${sessionId}/attendance`)
      setAttendanceList(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_load_attendance'))
    }
  }

  const toggleAttendance = async (userId: string) => {
    if (!selectedSessionForAttendance) return
    const isPresent = attendanceList.some((a: any) => a.user_id === userId)
    try {
      if (isPresent) {
        await api.delete(`/assembly/sessions/${selectedSessionForAttendance}/attendance/${userId}`)
      } else {
        await api.post(`/assembly/sessions/${selectedSessionForAttendance}/attendance`, { user_ids: [userId] })
      }
      loadAttendance(selectedSessionForAttendance)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_update_attendance'))
    }
  }

  const saveMinutes = async (sessionId: string) => {
    try {
      await api.put(`/assembly/sessions/${sessionId}/minutes`, { minutes: minutesText })
      setSelectedSessionForMinutes(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_save_minutes'))
    }
  }

  const loadQuorumConfigs = async () => {
    try {
      const data: any = await api.get('/assembly/quorum-config')
      setQuorumConfigs(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_load_quorum_config'))
    }
  }

  const loadFreqConfig = async () => {
    try {
      const data: any = await api.get('/assembly/frequency-config')
      if (data) {
        setFreqConfig(data)
        setFreqLoaded(true)
      }
    } catch (err) { /* ignore */ }
  }

  const saveFreqConfig = async () => {
    setFreqSaving(true)
    setError('')
    try {
      await api.put('/assembly/frequency-config', freqConfig)
      // Recargar para confirmar
      const data: any = await api.get('/assembly/frequency-config')
      if (data) setFreqConfig(data)
      setFreqEditing(false)
      setFreqSaving(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_save_frequency'))
      setFreqSaving(false)
    }
  }

  const closeAssemblySession = async (sessionId: string) => {
    if (!confirm(t('confirm_close_session'))) return
    try {
      await api.post(`/assembly/sessions/${sessionId}/close`, {})
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_close_session'))
    }
  }

  const updateQuorumConfig = async (sessionType: string, data: any, meetingType?: string) => {
    try {
      const mt = meetingType || 'assembly'
      await api.put(`/assembly/quorum-config/${sessionType}?meeting_type=${mt}`, data)
      loadQuorumConfigs()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_update_quorum'))
    }
  }

  const verifyQuorum = async (sessionId: string) => {
    try {
      const data: any = await api.post(`/assembly/sessions/${sessionId}/verify-quorum`, {})
      setQuorumResult(data)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_verify_quorum'))
    }
  }

  const doReschedule = async (sessionId: string) => {
    if (!rescheduleDate || !rescheduleTime) {
      setError(t('error_select_date_time'))
      return
    }
    try {
      const iso = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString()
      await api.post(`/assembly/sessions/${sessionId}/reschedule`, { new_start_time: iso })
      setRescheduleSession(null)
      setRescheduleDate('')
      setRescheduleTime('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_reschedule'))
    }
  }

  const selfCheckIn = async (sessionId: string) => {
    try {
      await api.post(`/assembly/sessions/${sessionId}/self-checkin`, {})
      setError('')
      alert(t('presence_confirmed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_confirm_presence'))
    }
  }

  const saveSessionEdit = async (sessionId: string) => {
    setError('')
    if (!editTitle.trim()) {
      setError(t('error_title_empty'))
      return
    }
    try {
      await api.put(`/assembly/sessions/${sessionId}`, { title: editTitle.trim(), description: editDescription })
      setSessions(sessions.map(s => s.id === sessionId ? { ...s, title: editTitle.trim(), description: editDescription } : s))
      setEditingSessionId(null)
      setEditTitle('')
      setEditDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_update_session'))
    }
  }

  const startEditSession = (s: any) => {
    setEditingSessionId(s.id)
    setEditTitle(s.title || '')
    setEditDescription(s.description || '')
  }

  const createSession = async () => {
    setError('')
    if (!newSession.title) {
      setError(t('error_title_required'))
      return
    }
    if (!sessionDate) {
      setError(t('error_select_date'))
      return
    }
    if (!sessionTime) {
      setError(t('error_select_time'))
      return
    }
    // Combinar fecha y hora en ISO 8601
    const start_time = new Date(`${sessionDate}T${sessionTime}:00`).toISOString()
    try {
      await api.post('/assembly/sessions', { ...newSession, meeting_type: meetingType, start_time })
      setShowNewSession(false)
      setNewSession({ session_type: 'ordinaria', title: '', description: '', is_presential: false, start_time: '' })
      setSessionDate('')
      setSessionTime('15:00')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_create_session'))
    }
  }

  const addBoard = async () => {
    setError('')
    if (!newBoard.user_id || !newBoard.position) {
      setError(t('error_user_position_required'))
      return
    }
    try {
      await api.post('/assembly/board', newBoard)
      setShowAddBoard(false)
      setNewBoard({ user_id: '', position: 'presidente' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_assign'))
    }
  }

  const removeBoard = async (id: string) => {
    try {
      await api.delete(`/assembly/board/${id}`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_save_config'))
    }
  }

  const renderProposalField = (field: ProposalField) => {
    const value = proposalFields[field.key] || ''

    if (field.type === 'select') {
      return (
        <div key={field.key}>
          <label className="label">{field.label}</label>
          <select
            className="input"
            value={value}
            onChange={(e) => setProposalFields({ ...proposalFields, [field.key]: e.target.value })}
          >
            <option value="">{t('assembly_select_option', '-- Selecciona una opcion --')}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">{field.help}</p>
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key}>
          <label className="label">{field.label}</label>
          <textarea
            className="input"
            rows={3}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => setProposalFields({ ...proposalFields, [field.key]: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">{field.help}</p>
        </div>
      )
    }

    if (field.type === 'entity' && field.endpoint) {
      return (
        <div key={field.key}>
          <EntitySelector
            label={field.label}
            helpText={field.help}
            placeholder={field.placeholder}
            value={value}
            onChange={(v) => setProposalFields({ ...proposalFields, [field.key]: v })}
            endpoint={field.endpoint}
            valueKey={field.valueKey || 'id'}
            labelKey={field.labelKey || 'name'}
            subLabelKey={field.subLabelKey}
            filterFn={field.filterFn}
            emptyMessage={field.emptyMessage}
          />
        </div>
      )
    }

    if (field.type === 'entity_toggle' && field.entityModes) {
      const activeModeKey = entityModes[field.key] || field.entityModes[0].key
      const activeMode = field.entityModes.find((m) => m.key === activeModeKey) || field.entityModes[0]
      return (
        <div key={field.key} className="space-y-2">
          <label className="label">{field.label}</label>
          <div className="flex gap-2">
            {field.entityModes.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => {
                  setEntityModes({ ...entityModes, [field.key]: mode.key })
                  setProposalFields({ ...proposalFields, [field.key]: '' })
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeModeKey === mode.key ? 'bg-trueque-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <EntitySelector
            label=""
            helpText={field.help}
            placeholder={field.placeholder}
            value={value}
            onChange={(v) => setProposalFields({ ...proposalFields, [field.key]: v })}
            endpoint={activeMode.endpoint}
            valueKey={activeMode.valueKey}
            labelKey={activeMode.labelKey}
            subLabelKey={activeMode.subLabelKey}
            filterFn={activeMode.filterFn}
            emptyMessage={activeMode.emptyMessage}
          />
        </div>
      )
    }

    // text / number
    return (
      <div key={field.key}>
        <label className="label">{field.label}</label>
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          className="input"
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => setProposalFields({ ...proposalFields, [field.key]: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">{field.help}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><VoteIcon size={24} />{t('title', 'Asamblea')}</h1>
        <button onClick={() => setShowHelp(!showHelp)} className="text-gray-500 hover:text-gray-700">
          <HelpCircle size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-3">
          <p><strong>{t('help_title', 'Asamblea - Ayuda')}</strong></p>
          <p><strong>{t('help_purpose_label', 'Para que sirve:')}</strong> {t('help_purpose', 'La asamblea es el organo de gobierno de la comunidad. Aqui se toman las decisiones importantes: cambios de limites, impuestos, admisiones, expulsion, politicas, etc.')}</p>
          <p><strong>{t('help_members_label', 'Miembros con voto:')}</strong> {t('help_members', 'Los miembros de la asamblea son los mismos miembros de la comunidad que tienen derecho a voto (segun su nivel). No se registran aparte. Los niveles de miembro definen quien tiene voz, quien tiene voto, y quien cuenta para el quorum.')}</p>
          <p><strong>{t('help_board_label', 'Junta Directiva:')}</strong> {t('help_board', 'Grupo de personas elegidas para decisiones que no requieren asamblea completa. Puede firmar decisiones con multi-firma.')}</p>
          <p><strong>{t('help_sessions_label', 'Sesiones:')}</strong> {t('help_sessions', 'Reuniones de asamblea (ordinarias, extraordinarias, urgentes). Las propuestas se discuten en sesiones.')}</p>
          <p><strong>{t('help_proposals_label', 'Propuestas:')}</strong> {t('help_proposals', 'Decisiones que se someten a votacion. Cada miembro con voto puede votar a favor, en contra o abstenerse. Cuando todos han votado, se ejecuta si hay mas votos a favor.')}</p>
          <p><strong>{t('help_taxes_label', 'Impuestos:')}</strong> {t('help_taxes', 'La asamblea decide la tasa de impuesto sobre transacciones. El dinero recaudado va a una cuenta de impuestos. La asamblea decide que hacer con ese dinero.')}</p>
          <button onClick={() => setShowHelp(false)} className="text-blue-600 underline">{t('help_close', t('common:close'))}</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => changeTab('proposals')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'proposals' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_proposals', 'Propuestas')}</button>
        <button onClick={() => changeTab('wallet')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'wallet' ? 'bg-amber-600 text-white' : 'bg-gray-200'}`}>{t('tab_wallet', 'Billetera / Fondo')}</button>
        <button onClick={() => changeTab('reports')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'reports' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_reports', 'Informes de Votacion')}</button>
        <button onClick={() => changeTab('members')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'members' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_members', 'Miembros')}</button>
        <button onClick={() => changeTab('board')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'board' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_board', 'Junta Directiva')}</button>
        <button onClick={() => changeTab('sessions')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sessions' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_sessions', 'Sesiones')}</button>
        <button onClick={() => changeTab('tax')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'tax' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_tax', 'Impuestos')}</button>
        <button onClick={() => changeTab('departments')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'departments' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Building2 size={14} className="inline mr-1" />{t('tab_departments', 'Departamentos')}</button>
        <button onClick={() => changeTab('config')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'config' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('tab_config', 'Configuracion')}</button>
      </div>

      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      {/* ===== BILLETERA / FONDO COMUNITARIO ===== */}
      {tab === 'wallet' && (
        <div className="space-y-4">
          <div className="card">
            <div className="text-white rounded-xl p-6 bg-gradient-to-r from-amber-600 to-yellow-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">{t('community_fund', 'Fondo Comunitario (Asamblea General)')}</p>
                  <p className="text-4xl font-bold mt-1">
                    {fundData?.balance != null ? `${fundData.balance >= 0 ? '+' : ''}${fmtTQ(fundData.balance)}` : '...'} {currency}
                  </p>
                  <p className="text-amber-200 text-xs mt-2">
                    Cuenta: @{translateAlias(fundData?.username || 'asamblea')}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs bg-amber-500/30 text-amber-100 px-2 py-0.5 rounded font-mono">@{translateAlias('asamblea')}</span>
                    <span className="text-xs bg-amber-500/30 text-amber-100 px-2 py-0.5 rounded font-mono">@{translateAlias('impuestos')}</span>
                    <span className="text-xs bg-amber-500/30 text-amber-100 px-2 py-0.5 rounded font-mono">@{translateAlias('fondo_comunitario')}</span>
                  </div>
                  <p className="text-amber-100 text-xs mt-2">{t('fund_aliases_note')}</p>
                </div>
                <DollarSign size={48} className="text-amber-200" />
              </div>
            </div>
          </div>

          {fundData?.fund_account && fundTxs.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-lg mb-3">{t('fund_movements', 'Movimientos del Fondo')}</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {fundTxs.map((t, i) => {
                  const isDebit = t.direction === 'debit'
                  const fromName = t.sender_display || t.from_user || t.sender_name || '???'
                  const toName = t.receiver_display || t.to_user || t.receiver_name || '???'
                  return (
                    <div key={i} className={`flex items-center justify-between p-2 rounded ${isDebit ? 'bg-red-50' : 'bg-green-50'}`}>
                      <div className="text-sm">
                        <p className="font-medium">{isDebit ? `${fromName} → ${toName}` : `${fromName} → ${toName}`}</p>
                        <p className="text-xs text-gray-500">{t.description || t.metadata?.description || ''}</p>
                        <p className="text-xs text-gray-400">{fmtDateTime(t.created_at)}</p>
                      </div>
                      <div className={`font-bold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                        {isDebit ? '-' : '+'}{fmtTQ(t.amount)} {currency}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>{t('fund_info_title', 'Fondo Comunitario - Informacion')}</strong></p>
            <p>{t('fund_info_1', 'El Fondo Comunitario ES la cuenta de la Asamblea General. No son cuentas separadas: es una sola cuenta que recibe los impuestos y sirve como tesoro comunitario.')}</p>
            <p><strong>{t('fund_info_transfer', 'Como transferirle:')}</strong> {t('fund_info_transfer_desc', 'Puedes transferir a esta cuenta usando cualquiera de estos 3 nombres:')} <b>@asamblea</b>, <b>@impuestos</b> o <b>@fondo_comunitario</b>.</p>
            <p><strong>{t('fund_info_distribute', 'Como se distribuye:')}</strong> {t('fund_info_distribute_desc', 'Para gastar dinero del fondo, crea una propuesta de "Distribucion de fondos" en la pestana Propuestas. Los miembros votan y, si se aprueba, se ejecuta la transferencia.')}</p>
          </div>
        </div>
      )}

      {/* ===== PROPUESTAS ===== */}
      {tab === 'proposals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><VoteIcon size={18} />{t('proposals_title', 'Propuestas de Asamblea')}</h2>
            <button onClick={() => setShowNewProposal(!showNewProposal)} className="btn-primary flex items-center gap-2"><Plus size={18} />{t('new_proposal', 'Nueva Propuesta')}</button>
          </div>

          {showNewProposal && (
            <div className="card space-y-4">
              <h3 className="font-semibold">{t('new_proposal', 'Nueva Propuesta')}</h3>

              <div>
                <label className="label">{t('proposal_type_label', 'Tipo de propuesta')}</label>
                <select className="input" value={proposalType} onChange={(e) => { setProposalType(e.target.value as ProposalType); setProposalFields({}); setEntityModes({}) }}>
                  {Object.entries(PROPOSAL_LABEL_KEYS).map(([k, key]) => (
                    <option key={k} value={k}>{t(key)}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">{t(PROPOSAL_HELP_KEYS[proposalType] || '')}</p>
              </div>

              {PROPOSAL_FIELDS(currency, t)[proposalType]?.map((field) => renderProposalField(field))}

              <div>
                <label className="label">{t('assembly_proposal_desc', 'Descripcion de la propuesta')}</label>
                <textarea className="input" rows={3} placeholder={t('assembly_proposal_desc_ph', 'Explica la propuesta para que los miembros puedan votar informados')} value={proposalDesc} onChange={(e) => setProposalDesc(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">{t('assembly_proposal_desc_hint', 'Explica claramente la decision que se somete a votacion. Los miembros usaran este texto para decidir su voto.')}</p>
              </div>

              <button onClick={createProposal} className="btn-primary">{t('assembly_create_proposal', 'Crear Propuesta')}</button>
            </div>
          )}

          {proposals.length === 0 && !showNewProposal ? (
            <div className="card text-center text-gray-500 py-8">
              <p>{t('no_proposals', 'No hay propuestas.')}</p>
              <p className="text-xs mt-2">{t('create_proposal_hint', 'Crea una propuesta para que la asamblea la revise.')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Propuestas pendientes de revision (proposed) */}
              {proposals.filter((p: any) => p.status === 'proposed').length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-purple-700 flex items-center gap-2">
                    <Clock size={16} />{t('assembly_pending_review', 'Pendientes de revision por la asamblea')} ({proposals.filter((p: any) => p.status === 'proposed').length})
                  </h3>
                  <p className="text-xs text-gray-500">{t('assembly_pending_review_desc', 'Estas propuestas fueron creadas pero el Secretario o persona autorizada todavia no las ha aprobado para incluir en la minuta y abrir votacion.')}</p>
                  {proposals.filter((p: any) => p.status === 'proposed').map((p: any, i: number) => (
                    <div key={i} className="card border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{String(t(PROPOSAL_LABEL_KEYS[p.proposal_type as ProposalType] || '', p.proposal_type))}</span>
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">{t('pending_approval', 'pendiente de aprobacion')}</span>
                        </div>
                        <span className="text-xs text-gray-400">{p.created_at?.slice(0, 10)}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                      <div className="flex gap-2 mt-3">
                        {/* El propietario puede editar o eliminar mientras este pendiente */}
                        {p.created_by === currentUser?.id && (
                          <>
                            <button
                              onClick={() => {
                                if (confirm(t('confirm_delete_proposal', 'Eliminar esta propuesta?'))) {
                                  api.delete(`/assembly/proposals/${p.id}`).then(() => load()).catch(() => {})
                                }
                              }}
                              className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              {t('common:delete')}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setShowProposalDetail(p)}
                          className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          {t('view_details', 'Ver detalles')}
                        </button>
                        {/* Solo el secretario/autorizado puede abrir votacion */}
                        {canApproveProposals && (
                          <button
                            onClick={() => { setVotingModal({ id: p.id, title: p.description }); setVotingDuration(1440); setVotingMode('remoto') }}
                            className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            {t('assembly_approve_open_voting', 'Aprobar y abrir votacion')}
                          </button>
                        )}
                        {/* Super admin o persona autorizada puede aprobar directamente sin votacion */}
                        {isSuperAdmin && superAdminEnabled && (
                          <button
                            onClick={async () => {
                              if (!confirm(t('assembly_confirm_direct_approve', 'Aprobar y ejecutar esta propuesta directamente sin votacion?'))) return
                              try {
                                await api.post(`/assembly/proposals/${p.id}/direct-approve`, {})
                                load()
                              } catch (e: any) {
                                setError(e?.message || t('assembly_error_direct_approve'))
                              }
                            }}
                            className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                          >
                            {t('assembly_direct_approve', 'Aprobar directamente')}
                          </button>
                        )}
                        {!canApproveProposals && !isSuperAdmin && !p.created_by && (
                          <span className="text-xs text-gray-400 italic">{t('assembly_waiting_approval', 'Esperando aprobacion del Secretario')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Propuestas en votacion y resultados */}
              {proposals.filter((p: any) => p.status !== 'proposed').length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                    <VoteIcon size={16} />{t('assembly_voting_results', 'En votacion y resultados')} ({proposals.filter((p: any) => p.status !== 'proposed').length})
                  </h3>
                  {proposals.filter((p: any) => p.status !== 'proposed').map((p: any, i: number) => (
                    <div key={i} className="card">
                    <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{String(t(PROPOSAL_LABEL_KEYS[p.proposal_type as ProposalType] || '', p.proposal_type))}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        p.status === 'executed' ? 'bg-green-100 text-green-700' :
                        p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        p.status === 'expired' ? 'bg-orange-100 text-orange-700' :
                        p.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{p.status === 'expired' ? t('assembly_status_expired', 'vencida') : p.status === 'pending' ? t('assembly_status_voting', 'en votacion') : p.status === 'approved' ? t('assembly_status_approved', 'aprobada') : p.status === 'executed' ? t('assembly_status_executed', 'ejecutada') : p.status === 'rejected' ? t('assembly_status_rejected', 'rechazada') : p.status === 'proposed' ? t('assembly_status_proposed', 'pendiente de revision') : p.status}</span>
                    </div>
                    <span className="text-xs text-gray-400">{p.created_at?.slice(0, 10)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{p.description}</p>

                  {/* Votos (secreto: solo cantidades, no quien voto) */}
                  <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                    <span className="text-green-600 font-medium">{t('assembly_votes_for', 'A favor:')} {p.votes_for || 0}</span>
                    <span className="text-red-600 font-medium">{t('assembly_votes_against', 'En contra:')} {p.votes_against || 0}</span>
                    <span className="text-gray-500 font-medium">{t('assembly_votes_abstain', 'Abstencion:')} {p.votes_abstain || 0}</span>
                    <span className="text-gray-400 font-medium">{t('assembly_votes_not_cast', 'No emitidos:')} {p.votes_not_cast ?? 0}</span>
                    {p.total_voting_members > 0 && (
                      <span className="text-gray-400 text-xs">{t('assembly_of_voting_members', 'de')} {p.total_voting_members} {t('assembly_with_vote_right', 'con derecho a voto')}</span>
                    )}
                  </div>

                  {/* Tiempo limite / countdown */}
                  {(p.status === 'pending' || p.status === 'voting') && p.voting_deadline && (
                    <div className="mt-2 text-xs text-orange-600 font-medium">
                      {(() => {
                        const deadline = new Date(p.voting_deadline).getTime()
                        const now = Date.now()
                        const remaining = deadline - now
                        if (remaining <= 0) return t('assembly_time_up', 'Tiempo agotado')
                        const mins = Math.floor(remaining / 60000)
                        const hrs = Math.floor(mins / 60)
                        const days = Math.floor(hrs / 24)
                        if (days > 0) return t('assembly_time_left_days', 'Quedan') + ` ${days}d ${hrs % 24}h ` + t('assembly_to_vote', 'para votar')
                        if (hrs > 0) return t('assembly_time_left_days', 'Quedan') + ` ${hrs}h ${mins % 60}m ` + t('assembly_to_vote', 'para votar')
                        return t('assembly_time_left_days', 'Quedan') + ` ${mins} ` + t('assembly_minutes_to_vote', 'minutos para votar')
                      })()}
                    </div>
                  )}
                  {p.status === 'expired' && (
                    <div className="mt-2 text-xs text-orange-600">
                      {t('assembly_voting_expired', 'El tiempo de votacion expiro. Crea una propuesta nueva para revotar.')}
                    </div>
                  )}

                  {/* Botones de voto */}
                  {(p.status === 'pending' || p.status === 'voting') && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => vote(p.id, 'for')} className="btn-secondary text-green-600 flex items-center gap-1"><Check size={16} />{t('assembly_vote_for', 'A favor')}</button>
                      <button onClick={() => vote(p.id, 'against')} className="btn-secondary text-red-600 flex items-center gap-1"><X size={16} />{t('assembly_vote_against', 'En contra')}</button>
                      <button onClick={() => vote(p.id, 'abstain')} className="btn-secondary flex items-center gap-1">{t('assembly_abstain', 'Abstener')}</button>
                      <button onClick={() => execute(p.id)} className="btn-primary ml-auto">{t('assembly_execute', 'Ejecutar decision')}</button>
                    </div>
                  )}

                  {/* Boton ver detalles */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setShowProposalDetail(p)}
                      className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      {t('view_details', 'Ver detalles')}
                    </button>
                  </div>
                </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== INFORMES DE VOTACION ===== */}
      {tab === 'reports' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><FileText size={18} />{t('assembly_reports_title', 'Informes de Votacion')}</h2>

          {/* Estadisticas generales */}
          {reportsStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card text-center">
                <div className="text-2xl font-bold text-trueque-600">{reportsStats.total_proposals}</div>
                <div className="text-xs text-gray-500">{t('assembly_total_proposals', 'Total propuestas')}</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-green-600">{reportsStats.approved}</div>
                <div className="text-xs text-gray-500">{t('assembly_approved', 'Aprobadas')}</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-red-600">{reportsStats.rejected}</div>
                <div className="text-xs text-gray-500">{t('assembly_rejected', 'Rechazadas')}</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-orange-600">{reportsStats.expired}</div>
                <div className="text-xs text-gray-500">{t('assembly_expired', 'Vencidas')}</div>
              </div>
            </div>
          )}

          {reportsStats && (
            <div className="card text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">{t('assembly_avg_participation', 'Participacion promedio:')}</span><span className="font-medium">{reportsStats.avg_participation}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('assembly_voting_members', 'Miembros con derecho a voto:')}</span><span className="font-medium">{reportsStats.total_voting_members}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('assembly_pending_proposals', 'Propuestas pendientes:')}</span><span className="font-medium">{reportsStats.pending}</span></div>
            </div>
          )}

          {/* Boton cargar */}
          {reports.length === 0 && !filterType && !filterFrom && !filterTo && !filterStatus && (
            <button onClick={loadReports} className="btn-primary">{t('assembly_load_reports', 'Cargar informes')}</button>
          )}

          {/* Filtros de busqueda */}
          {(reports.length > 0 || filterType || filterFrom || filterTo || filterStatus) && (
            <div className="card space-y-3">
              <h3 className="font-medium text-sm">{t('assembly_search_votes', 'Buscar votaciones por fecha, tipo o resultado')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t('assembly_vote_type', 'Tipo de votacion')}</label>
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">{t('assembly_all_types', 'Todos los tipos')}</option>
                    <option value="limit_change">{t('assembly_type_limit_change', 'Cambio de limites')}</option>
                    <option value="tax_change">{t('assembly_type_tax_change', 'Cambio de impuesto')}</option>
                    <option value="member_level">{t('assembly_type_member_level', 'Nivel de miembro')}</option>
                    <option value="org_level">{t('assembly_type_org_level', 'Nivel de organizacion')}</option>
                    <option value="admission">{t('assembly_type_admission', 'Admision')}</option>
                    <option value="expulsion">{t('assembly_type_expulsion', 'Expulsion')}</option>
                    <option value="budget_increase">{t('assembly_type_budget', 'Aumento de presupuesto')}</option>
                    <option value="fund_distribution">{t('assembly_type_fund_dist', 'Distribucion de fondos')}</option>
                    <option value="energy_rate_change">{t('assembly_type_energy', 'Cambio tarifa energetica')}</option>
                    <option value="federation_config">{t('assembly_type_federation', 'Configuracion federacion')}</option>
                    <option value="recovery_config">{t('assembly_type_recovery', 'Configuracion recuperacion')}</option>
                    <option value="policy">{t('assembly_type_policy', 'Politica general')}</option>
                    <option value="create_account">{t('assembly_type_create_account', 'Creacion de cuenta contable')}</option>
                    <option value="product_modification">{t('assembly_type_product_mod', 'Modificacion de producto')}</option>
                    <option value="product_approval">{t('assembly_type_product_approval', 'Aprobacion de producto')}</option>
                    <option value="product_disapproval">{t('assembly_type_product_disapproval', 'Desaprobacion de producto')}</option>
                    <option value="product_remove">{t('assembly_type_product_remove', 'Eliminacion de producto')}</option>
                    <option value="product_import">{t('assembly_type_product_import', 'Importar producto federado')}</option>
                    <option value="product_to_base">{t('assembly_type_product_to_base', 'Convertir a producto base')}</option>
                    <option value="governance_rule">{t('assembly_type_governance', 'Regla de gobernanza')}</option>
                    <option value="free_proposal">{t('assembly_type_free', 'Propuesta libre')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t('assembly_from', 'Desde')}</label>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={e => setFilterFrom(e.target.value)}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t('assembly_to', 'Hasta')}</label>
                  <input
                    type="date"
                    value={filterTo}
                    onChange={e => setFilterTo(e.target.value)}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{t('assembly_result', 'Resultado')}</label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">{t('assembly_all', 'Todos')}</option>
                    <option value="pending">{t('assembly_pending', 'Pendientes')}</option>
                    <option value="executed">{t('assembly_approved', 'Aprobadas')}</option>
                    <option value="rejected">{t('assembly_rejected', 'Rechazadas')}</option>
                    <option value="expired">{t('assembly_expired', 'Vencidas')}</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={loadReports} className="btn-primary text-sm">{t('assembly_search_btn', 'Buscar')}</button>
                <button
                  onClick={() => { setFilterType(''); setFilterFrom(''); setFilterTo(''); setFilterStatus(''); loadReports() }}
                  className="btn-secondary text-sm"
                >
                  {t('assembly_clear_filters', 'Limpiar filtros')}
                </button>
              </div>
            </div>
          )}

          {/* Lista de informes */}
          {reports.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{reports.length} {t('assembly_votes_registered', 'votaciones registradas')}</span>
                <button onClick={loadReports} className="text-xs text-blue-600 underline">{t('assembly_refresh', 'Actualizar')}</button>
              </div>
              {reports.map((rp: any, i: number) => (
                <div key={i} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{String(t(PROPOSAL_LABEL_KEYS[rp.proposal_type as ProposalType] || '', rp.proposal_type))}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          rp.status === 'executed' ? 'bg-green-100 text-green-700' :
                          rp.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          rp.status === 'expired' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{rp.result === 'approved' ? t('assembly_status_approved', 'aprobada') : rp.result === 'rejected' ? t('assembly_status_rejected', 'rechazada') : rp.result === 'expired' ? t('assembly_status_expired', 'vencida') : rp.result}</span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{rp.description}</p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="text-green-600">{t('assembly_votes_for', 'A favor:')} {rp.votes_for}</span>
                        <span className="text-red-600">{t('assembly_votes_against', 'En contra:')} {rp.votes_against}</span>
                        <span className="text-gray-500">{t('assembly_votes_abstain', 'Abstencion:')} {rp.votes_abstain}</span>
                        <span className="text-gray-400">{t('assembly_votes_not_cast', 'No emitidos:')} {rp.votes_not_cast}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
                        <span>{t('assembly_participation', 'Participacion:')} {fmtNumber(rp.participation_pct, 1)}%</span>
                        <span>{t('assembly_approval', 'Aprobacion:')} {fmtNumber(rp.approval_pct, 1)}%</span>
                        <span>{rp.created_at?.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => loadReportDetail(rp.id)}
                      className="text-xs text-blue-600 underline ml-2"
                    >
                      {t('assembly_view_detail', 'Ver detalle')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal de detalle del informe */}
          {selectedReport && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReport(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold">{t('assembly_report_title', 'Informe de Votacion')}</h3>
                  <button onClick={() => setSelectedReport(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-4 text-sm">
                  {/* Datos generales */}
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">{t('report_proposal_type')}:</span><span className="font-medium">{String(t(PROPOSAL_LABEL_KEYS[selectedReport.proposal_type as ProposalType] || '', selectedReport.proposal_type))}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t('report_status')}:</span><span className="font-medium">{selectedReport.result}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t('report_created_at')}:</span><span className="font-medium">{selectedReport.created_at?.replace('T', ' ').slice(0, 19)}</span></div>
                    {selectedReport.executed_at && <div className="flex justify-between"><span className="text-gray-500">{t('report_executed_at')}:</span><span className="font-medium">{selectedReport.executed_at?.replace('T', ' ').slice(0, 19)}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">{t('assembly_configured_time', 'Tiempo configurado:')}:</span><span className="font-medium">{selectedReport.configured_duration}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t('assembly_actual_voting_duration', 'Duracion real de votacion:')}:</span><span className="font-medium">{selectedReport.actual_voting_duration || t('assembly_no_votes', 'sin votos')}</span></div>
                    {selectedReport.first_vote_at && <div className="flex justify-between"><span className="text-gray-500">{t('assembly_first_vote', 'Primer voto:')}:</span><span className="font-medium">{selectedReport.first_vote_at?.replace('T', ' ').slice(0, 19)}</span></div>}
                    {selectedReport.last_vote_at && <div className="flex justify-between"><span className="text-gray-500">{t('assembly_last_vote', 'Ultimo voto:')}:</span><span className="font-medium">{selectedReport.last_vote_at?.replace('T', ' ').slice(0, 19)}</span></div>}
                  </div>

                  {/* Descripcion */}
                  <div className="card bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">{t('assembly_description', 'Descripcion')}</div>
                    <p className="text-sm">{selectedReport.description}</p>
                  </div>

                  {/* Conteo de votos */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="card text-center bg-green-50">
                      <div className="text-2xl font-bold text-green-600">{selectedReport.votes_for}</div>
                      <div className="text-xs text-gray-500">{t('assembly_vote_for', 'A favor')}</div>
                    </div>
                    <div className="card text-center bg-red-50">
                      <div className="text-2xl font-bold text-red-600">{selectedReport.votes_against}</div>
                      <div className="text-xs text-gray-500">{t('assembly_vote_against', 'En contra')}</div>
                    </div>
                    <div className="card text-center bg-gray-50">
                      <div className="text-2xl font-bold text-gray-600">{selectedReport.votes_abstain}</div>
                      <div className="text-xs text-gray-500">{t('assembly_votes_abstain', 'Abstencion')}</div>
                    </div>
                    <div className="card text-center bg-gray-50">
                      <div className="text-2xl font-bold text-gray-400">{selectedReport.votes_not_cast}</div>
                      <div className="text-xs text-gray-500">{t('assembly_votes_not_cast', 'No emitidos')}</div>
                    </div>
                  </div>

                  {/* Porcentajes */}
                  <div className="card space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">{t('assembly_total_votes_cast', 'Total votos emitidos:')}:</span><span className="font-medium">{selectedReport.total_votes_cast} {t('assembly_of', 'de')} {selectedReport.total_voting_members}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t('assembly_participation', 'Participacion:')}:</span><span className="font-medium">{selectedReport.participation_pct}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t('assembly_approval_on_cast', 'Aprobacion (sobre emitidos):')}:</span><span className="font-medium">{selectedReport.approval_pct}</span></div>
                  </div>

                  {/* Timeline de votos (secreto: sin nombres) */}
                  {selectedReport.vote_timeline && selectedReport.vote_timeline.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">{t('assembly_vote_timeline', 'Timeline de votos (orden de emision, voto secreto)')}</h4>
                      <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                        {selectedReport.vote_timeline.map((v: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className={
                              v.vote === 'a favor' ? 'text-green-600' :
                              v.vote === 'en contra' ? 'text-red-600' :
                              'text-gray-500'
                            }>{v.vote}</span>
                            <span className="text-gray-400">{v.timestamp?.replace('T', ' ').slice(0, 19)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-400 text-center pt-2">
                    {t('assembly_secret_vote_note', 'El voto es secreto. Este informe muestra cantidades y tiempos, no quien voto.')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {tab === 'members' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Users size={18} />{t('assembly_members_title', 'Miembros')}</h2>

          {/* Sub-pestanas de Miembros */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setMemberSubTab('voice_vote')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${memberSubTab === 'voice_vote' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('assembly_voice_vote', 'Con Voz y Voto')}</button>
            <button onClick={() => setMemberSubTab('voice')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${memberSubTab === 'voice' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('assembly_voice', 'Con Voz')}</button>
            <button onClick={() => setMemberSubTab('levels')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${memberSubTab === 'levels' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('assembly_member_levels', 'Niveles de Miembro')}</button>
            <button onClick={() => setMemberSubTab('orgs')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${memberSubTab === 'orgs' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}><Building2 size={14} className="inline mr-1" />{t('assembly_organizations', 'Organizaciones')}</button>
          </div>

          {/* ===== SUB-PESTANA: Niveles de Miembro ===== */}
          {memberSubTab === 'levels' && (
            <div className="space-y-4">
              <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
                <p>{t('assembly_levels_desc', 'Los niveles de miembro definen si tienen voz, voto, y si cuentan para el quorum. Cada nivel tiene sus propios limites de credito/debito y tasa de impuesto.')}</p>
              </div>
              {memberLevels.length > 0 ? (
                <div className="card">
                  <h3 className="font-medium mb-3">{t('assembly_member_levels', 'Niveles de Miembro')}</h3>
                  <div className="space-y-2">
                    {memberLevels.map((ml, i) => (
                      <div key={i} className="border-b border-gray-100 py-2 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{ml.name} (Nivel {ml.level})</span>
                          <div className="flex gap-2 text-xs">
                            {ml.has_voice && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t('assembly_voice_short', 'Voz')}</span>}
                            {ml.has_vote && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{t('assembly_vote_short', 'Voto')}</span>}
                            {ml.counts_in_quorum && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{t('assembly_quorum_short', 'Quorum')}</span>}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{ml.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {t('assembly_credit_limit', 'Limite credito:')} {fmtTQ(ml.credit_limit)} {currency} | {t('assembly_debit_limit', 'Limite debito:')} {fmtTQ(ml.debit_limit)} {currency}
                          {ml.tax_rate && ` | ${t('assembly_tax', 'Impuesto:')} ${fmtNumber(ml.tax_rate * 100, 2)}%`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card text-center text-gray-500 py-8">
                  <p>{t('no_member_levels', 'No hay niveles de miembro configurados.')}</p>
                </div>
              )}
            </div>
          )}

          {/* ===== SUB-PESTANA: Con Voz y Voto ===== */}
          {memberSubTab === 'voice_vote' && (
            <div className="space-y-4">
              <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
                <p>{t('assembly_voice_vote_desc', 'Miembros con voz y voto en la asamblea. Pueden participar en debates y votar decisiones.')}</p>
              </div>
              <MemberSearchAndPerms
                members={allMembers.filter((m: any) => m.has_voice && m.has_vote)}
                memberSearch={memberSearch}
                setMemberSearch={setMemberSearch}
                selectedMember={selectedMember}
                setSelectedMember={(m: any) => { setSelectedMember(m); setMemberPerms(m?.permissions || []); setPermMsg(null) }}
                memberPerms={memberPerms}
                setMemberPerms={setMemberPerms}
                allPerms={allPerms}
                canManage={canManage}
                permMsg={permMsg}
                setPermMsg={setPermMsg}
                setAllMembers={setAllMembers}
                badgeLabel={t('assembly_voice_plus_vote', 'Voz + Voto')}
                badgeColor="bg-green-100 text-green-700"
              />
            </div>
          )}

          {/* ===== SUB-PESTANA: Con Voz ===== */}
          {memberSubTab === 'voice' && (
            <div className="space-y-4">
              <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
                <p>{t('assembly_voice_desc', 'Todos los miembros con voz en la asamblea. Incluye los que tienen voto y los que solo tienen voz (sin voto).')}</p>
              </div>
              <MemberSearchAndPerms
                members={allMembers.filter((m: any) => m.has_voice)}
                memberSearch={memberSearch}
                setMemberSearch={setMemberSearch}
                selectedMember={selectedMember}
                setSelectedMember={(m: any) => { setSelectedMember(m); setMemberPerms(m?.permissions || []); setPermMsg(null) }}
                memberPerms={memberPerms}
                setMemberPerms={setMemberPerms}
                allPerms={allPerms}
                canManage={canManage}
                permMsg={permMsg}
                setPermMsg={setPermMsg}
                setAllMembers={setAllMembers}
                badgeLabel={(_m: any) => _m.has_vote ? t('assembly_voice_plus_vote', 'Voz + Voto') : t('assembly_voice_only', 'Solo Voz')}
                badgeColor={(_m: any) => _m.has_vote ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}
              />
            </div>
          )}

          {/* ===== SUB-PESTANA: Organizaciones ===== */}
          {memberSubTab === 'orgs' && (
            <div className="space-y-4">
              <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
                <p>{t('assembly_orgs_desc', 'Las organizaciones del nodo. Tambien pueden tener permisos asignados. Las organizaciones de la Asamblea (is_assembly_owned) pertenecen directamente al nodo.')}</p>
              </div>

              {/* Buscador de organizaciones */}
              <div className="card">
                <h3 className="font-medium mb-3 flex items-center gap-2"><Search size={16} />{t('assembly_search_orgs', 'Buscar Organizaciones')}</h3>
                <input
                  type="text"
                  className="input mb-3"
                  placeholder={t('assembly_search_ph')}
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                />

                {allOrgs.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">{t('assembly_no_orgs', 'No hay organizaciones cargadas.')}</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {allOrgs
                      .filter((o: any) => {
                        if (!orgSearch) return true
                        const q = orgSearch.toLowerCase()
                        return (o.username || '').toLowerCase().includes(q) ||
                               (o.display_name || '').toLowerCase().includes(q)
                      })
                      .map((o: any) => (
                        <div
                          key={o.id}
                          className={`flex items-center justify-between p-2 rounded border cursor-pointer transition ${selectedOrg?.id === o.id ? 'bg-trueque-50 border-trueque-300' : 'border-gray-200 hover:bg-gray-50'}`}
                          onClick={() => { setSelectedOrg(o); setOrgPerms(o.permissions || []); setOrgPermMsg(null) }}
                        >
                          <div>
                            <span className="font-medium text-sm">{o.display_name || o.username}</span>
                            <span className="text-xs text-gray-500 ml-2">@{o.username}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {o.is_assembly_owned && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{t('assembly_assembly_owned', 'Asamblea')}</span>}
                            {o.permissions && o.permissions.length > 0 && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{o.permissions.length} {t('assembly_perms')}</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Panel de permisos de la organizacion seleccionada */}
              {selectedOrg && (
                <div className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium flex items-center gap-2">
                      <KeyRound size={16} />
                      {t('assembly_perms_of')} {selectedOrg.display_name || selectedOrg.username}
                    </h3>
                    <button onClick={() => setSelectedOrg(null)} className="text-gray-400 hover:text-gray-600 text-sm">{t('common:close')}</button>
                  </div>

                  {/* Permisos actuales */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t('assembly_current_perms', 'Permisos actuales')} ({orgPerms.length})</h4>
                    {orgPerms.length === 0 ? (
                      <p className="text-sm text-gray-500">{t('assembly_no_direct_perms', 'No tiene permisos directos.')}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {orgPerms.map((p: string) => (
                          <div key={p} className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1 text-xs">
                            <span className="font-medium">{p}</span>
                            {canManage && (
                              <button
                                onClick={async () => {
                                  try {
                                    await api.delete(`/users/${selectedOrg.id}/permissions/${encodeURIComponent(p)}`)
                                    setOrgPerms(orgPerms.filter(x => x !== p))
                                    setOrgPermMsg({ type: 'success', text: t('perm_removed', { perm: p }) })
                                    setAllOrgs(allOrgs.map(o => o.id === selectedOrg.id ? { ...o, permissions: o.permissions.filter((x: string) => x !== p) } : o))
                                  } catch (e: any) {
                                    setOrgPermMsg({ type: 'error', text: e?.message || t('error_remove_perm') })
                                  }
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Asignar nuevo permiso */}
                  {canManage && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">{t('assembly_assign_new_perm', 'Asignar nuevo permiso')}</h4>
                      <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                        {allPerms
                          .filter((p: any) => !orgPerms.includes(p.name))
                          .map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between p-1 hover:bg-gray-50 rounded">
                              <div>
                                <span className="text-sm font-medium">{p.name}</span>
                                <span className="text-xs text-gray-500 ml-2">({p.category})</span>
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    await api.post(`/users/${selectedOrg.id}/permissions/grant`, { permission_name: p.name })
                                    setOrgPerms([...orgPerms, p.name])
                                    setOrgPermMsg({ type: 'success', text: t('perm_assigned', { perm: p.name }) })
                                    setAllOrgs(allOrgs.map(o => o.id === selectedOrg.id ? { ...o, permissions: [...(o.permissions || []), p.name] } : o))
                                  } catch (e: any) {
                                    setOrgPermMsg({ type: 'error', text: e?.message || t('error_assign_perm') })
                                  }
                                }}
                                className="text-xs text-trueque-600 hover:text-trueque-700 font-medium"
                              >
                                + {t('assembly_assign')}
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {orgPermMsg && (
                    <div className={`text-xs p-2 rounded-lg ${orgPermMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {orgPermMsg.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== JUNTA DIRECTIVA ===== */}
      {tab === 'board' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><Crown size={18} />{t('assembly_board_title', 'Junta Directiva')}</h2>
            {canManageBoard && (
              <button onClick={() => setShowAddBoard(!showAddBoard)} className="btn-primary flex items-center gap-2"><Plus size={18} />{t('assembly_assign_member')}</button>
            )}
          </div>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p>{t('assembly_board_desc', 'La junta directiva puede tomar decisiones con multi-firma sin necesidad de asamblea completa. Cada cargo tiene responsabilidades especificas.')}</p>
          </div>

          {showAddBoard && canManageBoard && (
            <div className="card space-y-4">
              <h3 className="font-semibold">{t('assembly_assign_board_member', 'Asignar Miembro de Junta')}</h3>
              <div>
                <label className="label">{t('assembly_user', 'Usuario')}</label>
                <select className="input" value={newBoard.user_id} onChange={(e) => setNewBoard({ ...newBoard, user_id: e.target.value })}>
                  <option value="">{t('assembly_select_member')}</option>
                  {votingMembers.map((m: any) => (
                    <option key={m.user_id || m.id} value={m.user_id || m.id}>
                      {m.display_name || m.username} {m.level_name ? `(${m.level_name})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">{t('assembly_only_existing_members', 'Solo puedes asignar miembros existentes del nodo.')}</p>
              </div>
              <div>
                <label className="label">{t('assembly_position', 'Cargo')}</label>
                <select className="input" value={newBoard.position} onChange={(e) => setNewBoard({ ...newBoard, position: e.target.value })}>
                  {BOARD_POSITIONS(t).map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <button onClick={addBoard} className="btn-primary">{t('assembly_assign')}</button>
            </div>
          )}

          {board.length === 0 && !showAddBoard ? (
            <div className="card text-center text-gray-500 py-8">
              <p>{t('no_board', 'No hay junta directiva configurada.')}</p>
              <p className="text-xs mt-2">{t('assign_board_hint', 'Asigna miembros a los cargos de la junta directiva.')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {board.map((b, i) => (
                <div key={i} className="card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crown size={20} className="text-amber-500" />
                    <div>
                      <span className="font-medium">{b.display_name || b.username}</span>
                      <p className="text-xs text-gray-500">{BOARD_POSITIONS(t).find((p) => p.value === b.position)?.label || b.position}</p>
                    </div>
                  </div>
                  {canManageBoard && (
                    <button onClick={() => removeBoard(b.id)} className="text-red-500"><Trash2 size={16} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== SESIONES ===== */}
      {tab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2"><Calendar size={18} />
              {meetingType === 'board' ? t('assembly_board_sessions', 'Sesiones de Junta Directiva') : t('assembly_assembly_sessions', 'Sesiones de Asamblea')}
            </h2>
            <button onClick={() => setShowNewSession(!showNewSession)} className="btn-primary flex items-center gap-2"><Plus size={18} />{t('assembly_new_session', 'Nueva Sesion')}</button>
          </div>

          {/* Toggle: Asamblea vs Junta Directiva */}
          <div className="flex gap-2">
            <button
              onClick={() => setMeetingType('assembly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${meetingType === 'assembly' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}
            >
              {t('assembly_all_members_tab', 'Asamblea (todos los miembros)')}
            </button>
            <button
              onClick={() => setMeetingType('board')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${meetingType === 'board' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
            >
              {t('assembly_board_only_tab', 'Junta Directiva (solo la junta)')}
            </button>
          </div>

          {meetingType === 'board' && (
            <div className="card bg-purple-50 border-purple-200 text-sm text-purple-700">
              {t('assembly_board_sessions_desc', 'Las sesiones de Junta Directiva son mas frecuentes y para decisiones operativas. Solo pueden votar los miembros de la junta directiva. El quorum es mas bajo.')}
            </div>
          )}

          {/* Filtro: pendientes vs pasadas */}
          <div className="flex gap-2">
            <button
              onClick={() => setSessionFilter('upcoming')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${sessionFilter === 'upcoming' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}
            >
              {meetingType === 'board' ? t('assembly_upcoming_board', 'Proximas juntas') : t('assembly_upcoming_assembly', 'Proximas asambleas')}
            </button>
            <button
              onClick={() => setSessionFilter('past')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${sessionFilter === 'past' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}
            >
              {meetingType === 'board' ? t('assembly_past_board', 'Juntas pasadas') : t('assembly_past_assembly', 'Asambleas pasadas')}
            </button>
          </div>

          {showNewSession && (
            <div className="card space-y-4">
              <h3 className="font-semibold">{t('assembly_new_session', 'Nueva Sesion')}</h3>
              <div>
                <label className="label">{t('assembly_session_type', 'Tipo de sesion')}</label>
                <select className="input" value={newSession.session_type} onChange={(e) => setNewSession({ ...newSession, session_type: e.target.value, start_time: '' })}>
                  <option value="ordinaria">{t('assembly_ordinary', 'Ordinaria')}</option>
                  <option value="extraordinaria">{t('assembly_extraordinary', 'Extraordinaria')}</option>
                  <option value="urgente">{t('assembly_urgent', 'Urgente')}</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {newSession.session_type === 'ordinaria' && t('assembly_ordinary_desc', 'Ordinaria = planificada. Minimo 7 dias de anticipacion.')}
                  {newSession.session_type === 'extraordinaria' && t('assembly_extraordinary_desc', 'Extraordinaria = fuera de plan. Minimo 24 horas de anticipacion.')}
                  {newSession.session_type === 'urgente' && t('assembly_urgent_desc', 'Urgente = decision rapida. Minimo 1 hora de anticipacion.')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('assembly_date', 'Fecha')}</label>
                  <input
                    type="date"
                    className="input"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">{t('assembly_time', 'Hora')}</label>
                  <input
                    type="time"
                    className="input"
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {newSession.session_type === 'ordinaria' && t('assembly_date_7d', 'La fecha debe ser al menos 7 dias desde ahora.')}
                {newSession.session_type === 'extraordinaria' && t('assembly_date_24h', 'La fecha debe ser al menos 24 horas desde ahora.')}
                {newSession.session_type === 'urgente' && t('assembly_date_1h', 'La fecha debe ser al menos 1 hora desde ahora.')}
              </p>
              <div>
                <label className="label">{t('assembly_title', 'Titulo')}</label>
                <input className="input" placeholder={t('assembly_title_ph', 'Ej: Asamblea mensual marzo')} value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} />
              </div>
              <div>
                <label className="label">{t('assembly_desc_optional', 'Descripcion (opcional)')}</label>
                <textarea className="input" rows={2} placeholder={t('assembly_topics', 'Temas a tratar')} value={newSession.description} onChange={(e) => setNewSession({ ...newSession, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_presential"
                  checked={newSession.is_presential}
                  onChange={(e) => setNewSession({ ...newSession, is_presential: e.target.checked })}
                  className="accent-trueque-600"
                />
                <label htmlFor="is_presential" className="text-sm">
                  <strong>{t('assembly_presential', 'Asamblea presencial')}</strong> - {t('assembly_presential_desc', 'Solo pueden votar los miembros presentes en la lista de asistencia')}
                </label>
              </div>
              <p className="text-xs text-gray-400">
                {t('assembly_presential_note', 'Si es presencial, despues de crear la sesion debes pasar la lista de asistencia. Los miembros que no esten en la lista no podran votar en esta asamblea.')}
              </p>
              <button onClick={createSession} className="btn-primary">{t('assembly_create_session', 'Crear Sesion')}</button>
            </div>
          )}

          {sessions.length === 0 && !showNewSession ? (
            <div className="card text-center text-gray-500 py-8">
              <p>{t('no_sessions', 'No hay sesiones programadas.')}</p>
              <p className="text-xs mt-2">{t('create_session_hint', 'Crea una sesion para discutir propuestas.')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <div key={i} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {editingSessionId === s.id ? (
                        <input
                          className="input flex-1"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder={t('assembly_title_asamblea_ph', 'Titulo de la asamblea')}
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{s.title}</span>
                      )}
                      {s.is_presential && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">{t('assembly_presential_badge', 'Presencial')}</span>
                      )}
                      {!s.is_presential && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{t('assembly_remote_badge', 'Remota')}</span>
                      )}
                      {canManage && editingSessionId !== s.id && (
                        <button
                          onClick={() => startEditSession(s)}
                          className="text-gray-400 hover:text-blue-600"
                          title={t('assembly_edit_title_desc', 'Editar titulo y descripcion')}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      s.status === 'active' ? 'bg-green-100 text-green-700' :
                      s.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                      s.status === 'waiting_quorum' ? 'bg-orange-100 text-orange-700' :
                      s.status === 'rescheduled' ? 'bg-blue-100 text-blue-700' :
                      s.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{
                      s.status === 'waiting_quorum' ? t('assembly_status_waiting_quorum', 'esperando quorum') :
                      s.status === 'rescheduled' ? t('assembly_status_rescheduled', 'reprogramada') :
                      s.status === 'cancelled' ? t('assembly_status_cancelled', 'cancelada') :
                      s.status
                    }</span>
                  </div>
                  {editingSessionId === s.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        className="input"
                        rows={2}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder={t('assembly_desc_topics_ph', 'Descripcion / temas a tratar')}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveSessionEdit(s.id)}
                          className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          {t('common:save')}
                        </button>
                        <button
                          onClick={() => { setEditingSessionId(null); setEditTitle(''); setEditDescription('') }}
                          className="text-xs px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                          {t('common:cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {t('assembly_type_label', 'Tipo:')} {s.session_type} | {s.start_time?.slice(0, 16).replace('T', ' ')}
                    {s.recall_number > 0 && <span className="text-orange-600"> | {t('assembly_recall', 'Llamado')} #{s.recall_number + 1}</span>}
                    {s.quorum_verified && <span className="text-green-600"> | {t('assembly_quorum_verified', 'Quorum verificado')}</span>}
                  </p>

                  {/* Minuta */}
                  {s.minutes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <strong>{t('assembly_minutes_label', 'Minuta:')}</strong>
                      <p className="whitespace-pre-wrap mt-1 max-h-32 overflow-y-auto">{s.minutes}</p>
                    </div>
                  )}

                  {/* Botones de gestion */}
                  {canStartAttendance(s) ? (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {s.is_presential && s.status !== 'completed' && (
                        <button
                          onClick={() => { setSelectedSessionForAttendance(s.id); loadAttendance(s.id) }}
                          className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                          {t('assembly_take_attendance', 'Pasar lista de asistencia')}
                        </button>
                      )}
                      {s.is_presential && (s.status === 'scheduled' || s.status === 'waiting_quorum') && (
                        <button
                          onClick={() => verifyQuorum(s.id)}
                          className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          {t('assembly_verify_quorum', 'Verificar quorum')}
                        </button>
                      )}
                      {s.is_presential && s.status === 'waiting_quorum' && (
                        <button
                          onClick={() => selfCheckIn(s.id)}
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          {t('assembly_confirm_presence', 'Confirmar mi presencia')}
                        </button>
                      )}
                      {s.is_presential && (s.status === 'rescheduled' || s.status === 'waiting_quorum') && (
                        <button
                          onClick={() => { setRescheduleSession(s); setRescheduleDate(''); setRescheduleTime('') }}
                          className="text-xs px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700"
                        >
                          {t('assembly_reschedule', 'Reprogramar (segundo llamado)')}
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedSessionForMinutes(s.id); setMinutesText(s.minutes || ''); setMinutesEditMode(false) }}
                        className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        {s.status === 'completed' ? t('assembly_view_acta', 'Ver acta') : (s.minutes ? t('assembly_view_minutes', 'Ver minuta') : t('assembly_write_minutes', 'Escribir minuta'))}
                      </button>
                      {(s.status === 'active' || s.status === 'waiting_quorum') && (
                        <button
                          onClick={() => closeAssemblySession(s.id)}
                          className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 ml-2"
                        >
                          {t('close_session_btn', 'Cerrar asamblea')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      <strong>{t('assembly_scheduled', 'Programada')}</strong> — {t('assembly_not_yet_open', 'Esta asamblea aun no ha llegado. El registro de asistencia se abrira')} {attendanceWindowHours} {attendanceWindowHours === 1 ? t('assembly_hour', 'hora') : t('assembly_hours', 'horas')} {t('assembly_before_scheduled', 'antes de la hora programada.')}
                    </div>
                  )}

                  {/* Resultado de verificacion de quorum */}
                  {quorumResult && quorumResult.session_id === s.id && (
                    <div className={`mt-2 p-3 rounded text-sm ${
                      quorumResult.has_quorum ? 'bg-green-50 text-green-700' :
                      quorumResult.status === 'cancelled' ? 'bg-red-50 text-red-700' :
                      'bg-orange-50 text-orange-700'
                    }`}>
                      <p className="font-medium">{quorumResult.message}</p>
                      <div className="flex gap-4 mt-1 text-xs">
                        <span>{t('assembly_present_count', 'Presentes:')} {quorumResult.present_count} {t('assembly_of', 'de')} {quorumResult.total_voting_members}</span>
                        <span>{t('assembly_attendance_label', 'Asistencia:')} {quorumResult.attendance_pct}</span>
                        <span>{t('assembly_quorum_required', 'Quorum requerido:')} {quorumResult.applied_quorum_pct}%</span>
                        {quorumResult.pending_confirmation > 0 && (
                          <span className="text-blue-600">{t('assembly_pending_confirmation', 'Pendientes por confirmar:')} {quorumResult.pending_confirmation}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Modal de asistencia */}
          {selectedSessionForAttendance && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSessionForAttendance(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold">{t('assembly_attendance_list', 'Lista de Asistencia')}</h3>
                  <button onClick={() => setSelectedSessionForAttendance(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-gray-600">
                    {t('assembly_attendance_desc', 'Marca los miembros presentes en la asamblea. Solo los miembros marcados podran votar en esta sesion presencial.')}
                  </p>

                  {/* Lista de miembros con checkbox */}
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {votingMembers.map((m: any) => {
                      const isPresent = attendanceList.some((a: any) => a.user_id === m.id)
                      return (
                        <label key={m.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${isPresent ? 'bg-green-50 border-green-300' : 'border-gray-200'}`}>
                          <input
                            type="checkbox"
                            checked={isPresent}
                            onChange={() => toggleAttendance(m.id)}
                            className="accent-trueque-600"
                          />
                          <span className="text-sm">{m.display_name || m.username}</span>
                          {isPresent && <span className="text-xs text-green-600">{t('assembly_present', 'Presente')}</span>}
                        </label>
                      )
                    })}
                  </div>

                  {attendanceList.length > 0 && (
                    <div className="text-sm text-gray-600">
                      {attendanceList.length} {t('assembly_members_present', 'miembros presentes')}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSelectedSessionForAttendance(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">{t('common:close')}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de minuta/acta */}
          {selectedSessionForMinutes && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSessionForMinutes(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold">{selectedSessionForMinutes && sessions.find(s => s.id === selectedSessionForMinutes)?.status === 'completed' ? t('assembly_acta_title', 'Acta de la Asamblea') : t('assembly_minuta_title', 'Minuta de la Asamblea')}</h3>
                  <button onClick={() => setSelectedSessionForMinutes(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-3">
                  {selectedSessionForMinutes && sessions.find(s => s.id === selectedSessionForMinutes)?.status === 'completed' && (
                    <p className="text-sm text-gray-600">
                      {t('assembly_acta_desc', 'Esta es el acta oficial de la asamblea.')} {minutesEditMode ? t('assembly_acta_edit_desc', 'Puedes agregar detalles adicionales pero las decisiones ya estan registradas.') : t('assembly_acta_readonly_desc', 'Solo lectura. Si tienes permiso, puedes editar con el boton abajo.')}
                    </p>
                  )}
                  {selectedSessionForMinutes && sessions.find(s => s.id === selectedSessionForMinutes)?.status !== 'completed' && !minutesEditMode && (
                    <p className="text-sm text-gray-600">
                      {minutesText ? t('assembly_minuta_read_desc', 'Minuta en lectura. Usa el boton editar para modificar.') : t('assembly_minuta_empty_desc', 'No hay minuta escrita aun. Usa el boton escribir para crearla.')}
                    </p>
                  )}
                  {minutesEditMode ? (
                    <textarea
                      className="input min-h-[300px]"
                      placeholder={t('assembly_minutes_ph', 'Ej:\n\nAsamblea del 15 de marzo de 2024\n\n1. Se aprobo por mayoria cambiar el limite de credito a 1000 TQ\n2. Se rechazo la propuesta de aumentar el impuesto al 3%\n3. Se admitio a Maria Rodriguez como miembro nuevo\n4. Pendiente: revisar el presupuesto del fondo comunitario')}
                      value={minutesText}
                      onChange={e => setMinutesText(e.target.value)}
                    />
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 min-h-[300px] whitespace-pre-wrap text-sm text-gray-800">
                      {minutesText || t('assembly_no_acta_content', 'No hay contenido en el acta.')}
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setSelectedSessionForMinutes(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">{t('common:close')}</button>
                    {selectedSessionForMinutes && sessions.find(s => s.id === selectedSessionForMinutes)?.status === 'completed' && (
                      <a
                        href={`${(window as any).__BASE_PATH__ ? (window as any).__BASE_PATH__ + '/api' : '/api'}/assembly/sessions/${selectedSessionForMinutes}/acta-pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        <FileText size={16} /> {t('assembly_download_acta_pdf', 'Descargar Acta PDF')}
                      </a>
                    )}
                    {minutesEditMode ? (
                      <>
                        <button onClick={() => { setMinutesEditMode(false) }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">{t('common:cancel')}</button>
                        <button onClick={() => saveMinutes(selectedSessionForMinutes)} className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">{t('common:save')}</button>
                      </>
                    ) : (
                      (canManageBoard || sessions.find(s => s.id === selectedSessionForMinutes)?.status !== 'completed') && (
                        <button onClick={() => setMinutesEditMode(true)} className="px-4 py-2 bg-trueque-600 text-white rounded-lg hover:bg-trueque-700">
                          {minutesText ? t('common:edit') : t('assembly_write', 'Escribir')}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de reprogramacion */}
          {rescheduleSession && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRescheduleSession(null)}>
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="font-bold">{t('assembly_reschedule_title', 'Reprogramar Asamblea')}</h3>
                  <button onClick={() => setRescheduleSession(null)} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    {t('assembly_reschedule_desc', 'La asamblea no alcanzo el quorum en el llamado')} #{(rescheduleSession.recall_number || 0) + 1}.
                    {t('assembly_reschedule_desc2', 'Al reprogramar, se crea el llamado')} #{(rescheduleSession.recall_number || 0) + 2} {t('assembly_reschedule_desc3', 'con un quorum mas bajo.')}
                    {t('assembly_reschedule_desc4', 'La lista de asistencia se reinicia: los miembros deben volver a confirmar su presencia.')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('assembly_date', 'Fecha')}</label>
                      <input
                        type="date"
                        className="input"
                        value={rescheduleDate}
                        onChange={e => setRescheduleDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">{t('assembly_time', 'Hora')}</label>
                      <input
                        type="time"
                        className="input"
                        value={rescheduleTime}
                        onChange={e => setRescheduleTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setRescheduleSession(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">{t('common:cancel')}</button>
                    <button
                      onClick={() => doReschedule(rescheduleSession.id)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                      disabled={!rescheduleTime}
                    >
                      {t('assembly_reschedule_btn', 'Reprogramar')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== IMPUESTOS ===== */}
      {tab === 'tax' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><DollarSign size={18} />{t('assembly_taxes_title', 'Impuestos')}</h2>

          {/* Explicacion */}
          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>{t('assembly_taxes_how_title', 'Impuestos - Como funciona')}</strong></p>
            <p>{t('assembly_taxes_how_desc', 'Los impuestos sobre las transacciones llegan automaticamente a la')} <strong>{t('assembly_taxes_assembly_account', 'cuenta de la Asamblea General')}</strong>. {t('assembly_taxes_no_separate', 'No hay una cuenta separada de impuestos: la Asamblea es la que recibe los impuestos y administra el Fondo Comunitario. Es una sola cuenta con tres nombres:')} <b>@asamblea</b>, <b>@impuestos</b> {t('assembly_taxes_and', 'y')} <b>@fondo_comunitario</b>.</p>
            <p><strong>{t('assembly_taxes_calc_title', 'Como se calcula el impuesto:')}</strong> {t('assembly_taxes_calc_desc', 'Cada nivel de miembro tiene su propia tasa de impuesto. Cuando un miembro hace una transaccion, se aplica la tasa de su nivel. Por ejemplo, un miembro "pleno" puede tener 2% y un miembro "aspirante" 0%. Las organizaciones y cooperativas tambien pueden tener tasas diferentes.')}</p>
            <p><strong>{t('assembly_taxes_change_title', 'Como cambiar las tasas:')}</strong> {t('assembly_taxes_change_desc', 'Los cambios se hacen por votacion en la Asamblea. Crea una propuesta de tipo')} <b>{t('assembly_taxes_change_type', '"Cambio de impuestos"')}</b> {t('assembly_taxes_change_desc2', 'en la pestana')} <b>{t('tab_proposals', 'Propuestas')}</b>, {t('assembly_taxes_change_desc3', 'indicando el nivel de miembro y la nueva tasa. La Asamblea decide segun su configuracion de aprobacion (voto de toda la asamblea, junta directiva, o persona designada).')}</p>
            <p><strong>{t('assembly_taxes_use_title', 'Como usar el dinero recaudado:')}</strong> {t('assembly_taxes_use_desc', 'Para distribuir los fondos, crea una propuesta de')} <b>{t('assembly_taxes_use_type', '"Distribucion de fondos"')}</b> {t('assembly_taxes_use_desc2', 'indicando la cuenta destino (organizacion, departamento, responsable o proyecto) y el monto.')}</p>
          </div>

          {/* Tasas por nivel de miembro */}
          {taxConfig?.level_taxes && taxConfig.level_taxes.length > 0 && (
            <div className="card">
              <h3 className="font-medium mb-3">{t('assembly_tax_rates_by_level', 'Tasas de Impuesto por Nivel de Miembro')}</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-gray-600">
                  <th className="py-2">{t('assembly_level', 'Nivel')}</th>
                  <th>{t('assembly_description', 'Descripcion')}</th>
                  <th>{t('assembly_tax_rate', 'Tasa de impuesto')}</th>
                </tr></thead>
                <tbody>
                  {taxConfig.level_taxes.map((lt: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 font-medium">{lt.name} (Nivel {lt.level})</td>
                      <td className="text-gray-500">{lt.description}</td>
                      <td className={lt.tax_rate > 0 ? 'text-amber-600 font-bold' : 'text-green-600'}>
                        {lt.tax_rate > 0 ? `${fmtNumber(lt.tax_rate * 100, 2)}%` : t('assembly_exempt', 'Exento')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-2">
                {t('assembly_tax_per_level_note', 'Cada nivel de miembro tiene su propia tasa. Para cambiar una tasa, crea una propuesta de "Cambio de impuestos" en la pestana Propuestas.')}
              </p>
            </div>
          )}

          {/* Configuracion global */}
          {taxConfig && (
            <div className="card">
              <h3 className="font-medium mb-3">{t('assembly_tax_global_config', 'Configuracion Global de Impuestos')}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="label">{t('assembly_tax_default_rate', 'Tasa global por defecto')}</label>
                  <b>{taxConfig.tax_rate ? `${fmtNumber(taxConfig.tax_rate * 100, 2)}%` : '0%'}</b>
                  <p className="text-xs text-gray-400">{t('assembly_tax_default_desc', 'Se aplica si el nivel del miembro no tiene tasa propia')}</p>
                </div>
                <div>
                  <label className="label">{t('assembly_status', 'Estado')}</label>
                  <b>{taxConfig.is_active ? t('assembly_active', 'Activo') : t('assembly_inactive', 'Inactivo')}</b>
                </div>
                <div>
                  <label className="label">{t('assembly_min_amount', 'Monto minimo')}</label>
                  <b>{fmtTQ(taxConfig.min_amount || 0)} {currency}</b>
                  <p className="text-xs text-gray-400">{t('assembly_min_amount_desc', 'Transacciones menores a este monto no pagan impuesto')}</p>
                </div>
                <div>
                  <label className="label">{t('assembly_applies_to', 'Aplica a')}</label>
                  <b>{taxConfig.applies_to === 'all' ? t('assembly_all_transactions', 'Todas las transacciones') : taxConfig.applies_to}</b>
                </div>
              </div>
            </div>
          )}

          {/* Cuenta de la Asamblea */}
          {taxAccount && (
            <div className="card">
              <h3 className="font-medium mb-3">{t('assembly_tax_account_title')}</h3>
              {taxAccount.tax_account ? (
                <div className="text-sm">
                  <p><span className="text-gray-500">{t('assembly_account_label')}:</span> <b>{translateAccountName(taxAccount.tax_account_display || taxAccount.tax_account_name || taxAccount.tax_account, taxAccount.tax_account_name)}</b></p>
                  <p className="mt-1"><span className="text-gray-500">{t('assembly_balance')}:</span> <b className="text-trueque-700">{fmtTQ(taxAccount.balance)} {currency}</b></p>
                  <p className="mt-2 text-xs text-gray-500">
                    {t('assembly_tax_account_desc')}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-600">
                  {t('assembly_tax_account_not_found')}
                </p>
              )}
            </div>
          )}

          {canManageTax && (
            <div className="card border-amber-200">
              <h3 className="font-medium mb-2">{t('assembly_tax_admin', 'Administracion de Impuestos')}</h3>
              <p className="text-xs text-gray-500 mb-3">
                {t('assembly_tax_admin_desc1', 'El administrador puede cambiar la tasa de impuesto global directamente durante la configuracion inicial del sistema. Una vez que la asamblea este funcionando, los cambios se hacen por votacion. Las tasas por nivel de miembro se cambian con propuestas de "Cambio de impuestos" en la pestana Propuestas.')}
              </p>
              <p className="text-xs text-gray-500">
                {t('assembly_tax_admin_desc2', 'Para distribuir los fondos recaudados, crea una propuesta de "Distribucion de fondos" indicando la cuenta destino y el monto.')}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'departments' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Building2 size={18} />{t('assembly_departments_title', 'Departamentos')}</h2>

          {/* Sub-pestanas de Departamentos */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setDeptSubTab('assembly')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${deptSubTab === 'assembly' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('assembly_depts_assembly', 'De la Asamblea')}</button>
            <button onClick={() => setDeptSubTab('organizations')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${deptSubTab === 'organizations' ? 'bg-trueque-600 text-white' : 'bg-gray-200'}`}>{t('assembly_depts_orgs', 'De Organizaciones')}</button>
          </div>

          {/* ===== SUB-PESTANA: Departamentos de la Asamblea ===== */}
          {deptSubTab === 'assembly' && (
            <div className="space-y-4">
              <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
                <p>{t('assembly_depts_assembly_desc', 'Departamentos de la Asamblea. La Asamblea no aparece en la pagina de Organizaciones, por eso sus departamentos se gestionan aqui.')}</p>
              </div>
              <DeptListWithRoles
                depts={allDepts.filter((d: any) => !d.parent_organization_id || d.org_name === t('assembly_general_assembly'))}
                expandedDept={expandedDept}
                setExpandedDept={setExpandedDept}
                deptRoles={deptRoles}
                setDeptRoles={setDeptRoles}
                deptMembers={deptMembers}
                setDeptMembers={setDeptMembers}
                showCreateRole={showCreateRole}
                setShowCreateRole={setShowCreateRole}
                showAssignMember={showAssignMember}
                setShowAssignMember={setShowAssignMember}
                newRole={newRole}
                setNewRole={setNewRole}
                newMember={newMember}
                setNewMember={setNewMember}
                allPerms={allPerms}
                allMembers={allMembers}
                rolePermsList={rolePermsList}
                setRolePermsList={setRolePermsList}
                showRolePerms={showRolePerms}
                setShowRolePerms={setShowRolePerms}
                canManage={canManage}
              />
            </div>
          )}

          {/* ===== SUB-PESTANA: Departamentos de Organizaciones (acordeon por org) ===== */}
          {deptSubTab === 'organizations' && (
            <div className="space-y-4">
              <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
                <p>{t('assembly_depts_orgs_desc', 'Departamentos de otras organizaciones. Haz clic en una organizacion para desplegar sus departamentos.')}</p>
              </div>

              {/* Agrupar por organizacion */}
              {(() => {
                const orgDepts = allDepts.filter((d: any) => d.parent_organization_id && d.org_name !== t('assembly_general_assembly'))
                // Agrupar por org_name
                const grouped: Record<string, any[]> = {}
                orgDepts.forEach((d: any) => {
                  const key = d.org_name || t('assembly_no_organization')
                  if (!grouped[key]) grouped[key] = []
                  grouped[key].push(d)
                })
                const orgNames = Object.keys(grouped).sort()

                if (orgNames.length === 0) {
                  return <p className="text-sm text-gray-500 py-4">{t('assembly_no_org_depts', 'No hay departamentos de otras organizaciones.')}</p>
                }

                return (
                  <div className="space-y-2">
                    {orgNames.map((orgName: string) => (
                      <div key={orgName} className="border rounded-lg overflow-hidden">
                        <div
                          className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            // Toggle: si ya esta expandido para esta org, colapsar
                            const orgExpanded = expandedDept === `org:${orgName}` ? null : `org:${orgName}`
                            setExpandedDept(orgExpanded)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-gray-500" />
                            <span className="font-medium text-sm">{orgName}</span>
                            <span className="text-xs text-gray-500">({grouped[orgName].length} {t('assembly_deptos')})</span>
                          </div>
                          <span className="text-gray-400 text-xs">{expandedDept === `org:${orgName}` ? '▼' : '▶'}</span>
                        </div>
                        {expandedDept === `org:${orgName}` && (
                          <div className="p-3 bg-white">
                            <DeptListWithRoles
                              depts={grouped[orgName]}
                              expandedDept={expandedDept}
                              setExpandedDept={setExpandedDept}
                              deptRoles={deptRoles}
                              setDeptRoles={setDeptRoles}
                              deptMembers={deptMembers}
                              setDeptMembers={setDeptMembers}
                              showCreateRole={showCreateRole}
                              setShowCreateRole={setShowCreateRole}
                              showAssignMember={showAssignMember}
                              setShowAssignMember={setShowAssignMember}
                              newRole={newRole}
                              setNewRole={setNewRole}
                              newMember={newMember}
                              setNewMember={setNewMember}
                              allPerms={allPerms}
                              allMembers={allMembers}
                              rolePermsList={rolePermsList}
                              setRolePermsList={setRolePermsList}
                              showRolePerms={showRolePerms}
                              setShowRolePerms={setShowRolePerms}
                              canManage={canManage}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Shield size={18} />{t('assembly_config_title', 'Configuracion de Asamblea')}</h2>

          {/* ===== Configuracion de quorum - Asamblea ===== */}
          <div className="card bg-purple-50 border-purple-200 text-sm text-gray-700 space-y-2">
            <p><strong>{t('assembly_quorum_help_title', 'Quorum de Asamblea - Ayuda')}</strong></p>
            <p>{t('assembly_quorum_help_desc', 'El quorum es el porcentaje minimo de miembros con derecho a voto que deben estar presentes para que la asamblea sea valida.')}</p>
            <ul className="list-disc list-inside space-y-1">
              <li><b>{t('assembly_quorum_first_call', 'Primer llamado')}</b>: {t('assembly_quorum_first_call_desc', 'porcentaje requerido en la fecha original.')}</li>
              <li><b>{t('assembly_quorum_second_call', 'Segundo llamado')}</b>: {t('assembly_quorum_second_call_desc', 'porcentaje reducido si se reprograma (ej: 50% primer llamado, 30% segundo llamado).')}</li>
              <li><b>{t('assembly_quorum_grace', 'Periodo de gracia')}</b>: {t('assembly_quorum_grace_desc', 'horas que se esperan despues de la hora de inicio antes de declarar la asamblea invalida.')}</li>
              <li><b>{t('assembly_quorum_max_recall', 'Maximo rellamados')}</b>: {t('assembly_quorum_max_recall_desc', 'cuantas veces se puede reprogramar la misma asamblea.')}</li>
            </ul>
            <p>{t('assembly_quorum_no_quorum_desc', 'Si no se alcanza el quorum despues del periodo de gracia, la asamblea se puede reprogramar (si esta permitido) o se cancela.')}</p>
          </div>

          {quorumConfigs.length === 0 ? (
            <button onClick={loadQuorumConfigs} className="btn-primary">{t('assembly_load_quorum_config', 'Cargar configuracion de quorum')}</button>
          ) : (
            <div className="space-y-3">
              {quorumConfigs.filter((qc: any) => qc.meeting_type !== 'board').map((qc: any) => (
                <QuorumConfigCard key={qc.id} config={qc} onSave={updateQuorumConfig} />
              ))}
            </div>
          )}

          {/* ===== Configuracion de quorum - Junta Directiva ===== */}
          <div className="card bg-purple-50 border-purple-200 text-sm text-gray-700 space-y-2 mt-6">
            <p><strong>{t('assembly_board_quorum_help_title', 'Quorum de Junta Directiva - Ayuda')}</strong></p>
            <p>{t('assembly_board_quorum_help_desc', 'El quorum de la junta directiva es el porcentaje minimo de miembros de la junta que deben estar presentes para que la reunion sea valida.')}</p>
            <p>{t('assembly_board_quorum_help_desc2', 'Como la junta tiene menos miembros (ej: 5-7), el quorum es sobre ese numero, no sobre todos los miembros del nodo.')}</p>
            <p className="text-xs text-purple-600 mt-1"><strong>{t('assembly_important', 'Importante:')}</strong> {t('assembly_board_quorum_note', 'cambiar el quorum de la junta directiva es una decision de la Asamblea, no de la junta.')}</p>
          </div>

          {quorumConfigs.length === 0 ? (
            <button onClick={loadQuorumConfigs} className="btn-primary">{t('assembly_load_quorum_config', 'Cargar configuracion de quorum')}</button>
          ) : (
            <div className="space-y-3">
              {quorumConfigs.filter((qc: any) => qc.meeting_type === 'board').map((qc: any) => (
                <QuorumConfigCard key={qc.id} config={qc} onSave={(st: string, data: any) => updateQuorumConfig(st, data, 'board')} />
              ))}
            </div>
          )}

          {/* ===== Convocatoria automatica ===== */}
          <h3 className="font-semibold flex items-center gap-2 mt-6"><Calendar size={18} />{t('assembly_auto_convocation', 'Convocatoria Automatica')}</h3>
          <div className="card space-y-4">
            <p className="text-sm text-gray-600">{t('assembly_auto_convocation_desc', 'Configura cada cuanto se convoca la asamblea ordinaria. Al cerrar una asamblea, se agenda la siguiente automaticamente.')}</p>
            <p className="text-xs text-blue-600 bg-blue-50 rounded p-2">{t('assembly_auto_convocation_note', 'Estos son ajustes basicos. No requieren aprobacion de asamblea. Pueden editarlos: administrador, junta directiva, director o secretario.')}</p>

            {/* Modo lectura */}
            {!freqEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="label">{t('assembly_frequency', 'Frecuencia')}</label>
                    <b>
                      {freqConfig.ordinary_frequency_months === 0 && t('assembly_no_auto_convocate', 'No auto-convocar')}
                      {freqConfig.ordinary_frequency_months === 1 && t('assembly_every_month', 'Cada mes')}
                      {freqConfig.ordinary_frequency_months === 2 && t('assembly_every_2_months', 'Cada 2 meses')}
                      {freqConfig.ordinary_frequency_months === 3 && t('assembly_every_3_months', 'Cada 3 meses (trimestral)')}
                      {freqConfig.ordinary_frequency_months === 6 && t('assembly_every_6_months', 'Cada 6 meses (semestral)')}
                      {freqConfig.ordinary_frequency_months === 12 && t('assembly_every_12_months', 'Cada 12 meses (anual)')}
                    </b>
                  </div>
                  {freqConfig.ordinary_frequency_months > 0 && (
                    <>
                      <div>
                        <label className="label">{t('assembly_preferred_day', 'Dia preferido')}</label>
                        <b>{freqConfig.preferred_day_of_month === 0 ? t('assembly_any_day', 'Cualquier dia') : `${t('assembly_day', 'Dia')} ${freqConfig.preferred_day_of_month}`}</b>
                      </div>
                      <div>
                        <label className="label">{t('assembly_preferred_hour', 'Hora preferida')}</label>
                        <b>{freqConfig.preferred_hour.toString().padStart(2, '0')}:00</b>
                      </div>
                      <div>
                        <label className="label">{t('assembly_notify_before', 'Notificar con anticipacion')}</label>
                        <b>{freqConfig.notification_days_before} {t('assembly_days_before', 'dias antes')}</b>
                      </div>
                      <div>
                        <label className="label">{t('assembly_register_attendance', 'Registrar asistencia')}</label>
                        <b>{freqConfig.attendance_window_hours || 1} {freqConfig.attendance_window_hours === 1 ? t('assembly_hour', 'hora') : t('assembly_hours', 'horas')} {t('assembly_before', 'antes')}</b>
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => setFreqEditing(true)} className="btn-primary">{t('common:edit')}</button>
              </div>
            ) : (
              /* Modo edicion */
              <div className="space-y-3">
                <div>
                  <label className="label">{t('assembly_freq_ordinary', 'Frecuencia de asambleas ordinarias')}</label>
                  <select className="input" value={freqConfig.ordinary_frequency_months} onChange={e => setFreqConfig({ ...freqConfig, ordinary_frequency_months: parseInt(e.target.value) })}>
                    <option value={0}>{t('assembly_no_auto_convocate', 'No auto-convocar')}</option>
                    <option value={1}>{t('assembly_every_month', 'Cada mes')}</option>
                    <option value={2}>{t('assembly_every_2_months', 'Cada 2 meses')}</option>
                    <option value={3}>{t('assembly_every_3_months', 'Cada 3 meses (trimestral)')}</option>
                    <option value={6}>{t('assembly_every_6_months', 'Cada 6 meses (semestral)')}</option>
                    <option value={12}>{t('assembly_every_12_months', 'Cada 12 meses (anual)')}</option>
                  </select>
                </div>
                {freqConfig.ordinary_frequency_months > 0 && (
                  <>
                    <div>
                      <label className="label">{t('assembly_preferred_day_month', 'Dia preferido del mes')}</label>
                      <select className="input" value={freqConfig.preferred_day_of_month} onChange={e => setFreqConfig({ ...freqConfig, preferred_day_of_month: parseInt(e.target.value) })}>
                        <option value={0}>{t('assembly_any_day', 'Cualquier dia')}</option>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{t('assembly_day', 'Dia')} {d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('assembly_preferred_hour', 'Hora preferida')}</label>
                      <select className="input" value={freqConfig.preferred_hour} onChange={e => setFreqConfig({ ...freqConfig, preferred_hour: parseInt(e.target.value) })}>
                        {Array.from({ length: 24 }, (_, i) => i).map(h => (
                          <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('assembly_notify_before', 'Notificar con anticipacion')}</label>
                      <select className="input" value={freqConfig.notification_days_before} onChange={e => setFreqConfig({ ...freqConfig, notification_days_before: parseInt(e.target.value) })}>
                        <option value={1}>1 {t('assembly_day_before', 'dia antes')}</option>
                        <option value={3}>3 {t('assembly_days_before', 'dias antes')}</option>
                        <option value={7}>7 {t('assembly_days_before', 'dias antes')}</option>
                        <option value={14}>14 {t('assembly_days_before', 'dias antes')}</option>
                        <option value={30}>30 {t('assembly_days_before', 'dias antes')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('assembly_register_attendance_hours', 'Registrar asistencia (horas antes)')}</label>
                      <select className="input" value={freqConfig.attendance_window_hours || 1} onChange={e => setFreqConfig({ ...freqConfig, attendance_window_hours: parseInt(e.target.value) })}>
                        <option value={1}>1 {t('assembly_hour_before', 'hora antes')}</option>
                        <option value={2}>2 {t('assembly_hours_before', 'horas antes')}</option>
                        <option value={3}>3 {t('assembly_hours_before', 'horas antes')}</option>
                        <option value={6}>6 {t('assembly_hours_before', 'horas antes')}</option>
                        <option value={12}>12 {t('assembly_hours_before', 'horas antes')}</option>
                        <option value={24}>24 {t('assembly_hours_before_full_day', 'horas antes (todo el dia)')}</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">{t('assembly_attendance_window_desc', 'Desde cuando se puede empezar a registrar asistencia antes de la hora programada.')}</p>
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <button onClick={saveFreqConfig} disabled={freqSaving} className="btn-primary">
                    {freqSaving ? t('common:loading') : t('common:save')}
                  </button>
                  <button onClick={() => { setFreqEditing(false); loadFreqConfig() }} className="btn-secondary">{t('common:cancel')}</button>
                </div>
              </div>
            )}
          </div>
          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700">
            <p><strong>{t('assembly_convocation_rules', 'Reglas de convocatoria:')}</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>{t('assembly_convocation_rule1', 'Al cerrar una asamblea ordinaria, se agenda la siguiente automaticamente')}</li>
              <li>{t('assembly_convocation_rule2', 'Si se modifica la fecha de una asamblea ordinaria, sigue siendo ordinaria')}</li>
              <li>{t('assembly_convocation_rule3', 'Si se crea una asamblea nueva ademas de la ordinaria, esa es extraordinaria')}</li>
              <li>{t('assembly_convocation_rule4', 'Los miembros reciben notificacion con la anticipacion configurada')}</li>
              <li>{t('assembly_convocation_rule5', 'Las asambleas extraordinarias no se auto-convocan')}</li>
            </ul>
          </div>

          {/* ===== Configuracion de aprobaciones ===== */}
          <h3 className="font-semibold flex items-center gap-2 mt-6"><Shield size={18} />{t('assembly_approval_config_title', 'Configuracion de Aprobaciones')}</h3>

          <div className="card bg-blue-50 border-blue-200 text-sm text-gray-700 space-y-2">
            <p><strong>{t('assembly_approval_config_how', 'Como funciona la configuracion de aprobaciones')}</strong></p>
            <p>{t('assembly_approval_config_desc', 'Aqui se define')} <b>{t('assembly_who_approves', 'quien aprueba')}</b> {t('assembly_approval_config_desc2', 'cada tipo de decision de la comunidad. Cada tipo de propuesta puede tener un metodo de aprobacion diferente. Por ejemplo, puedes configurar que aprobar productos lo decida la Junta Directiva rapidamente, pero eliminar productos requiera votacion de toda la Asamblea con 2/3 de mayoria.')}</p>
            <p><strong>{t('assembly_approval_methods_title', 'Metodos de aprobacion disponibles:')}</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li><b>{t('assembly_method_assembly', 'Asamblea (votacion)')}</b>: {t('assembly_method_assembly_desc', 'Todos los miembros con derecho a voto votan a favor o en contra. Se aprueba si el porcentaje de votos a favor supera el umbral. Ej: 50% = mayoria simple, 66.67% = 2/3, 75% = 3/4, 100% = unanimidad.')}</li>
              <li><b>{t('assembly_method_board', 'Junta Directiva')}</b>: {t('assembly_method_board_desc', 'Solo los miembros de la junta directiva del nodo votan. Mas rapido que la Asamblea completa. Ideal para decisiones administrativas del dia a dia.')}</li>
              <li><b>{t('assembly_method_council', 'Comision/Departamento')}</b>: {t('assembly_method_council_desc', 'Una comision o departamento especifico decide. Selecciona cual comision. Las comisiones se crean en la seccion de Departamentos. Ideal para decisiones tecnicas que requieren conocimiento especializado.')}</li>
              <li><b>{t('assembly_method_person', 'Persona especifica')}</b>: {t('assembly_method_person_desc', 'Una sola persona autorizada aprueba. Util para decisiones rutinarias que no requieren debate. Selecciona quien es la persona autorizada.')}</li>
              <li><b>{t('assembly_method_authorized_any', 'Cualquiera de los autorizados')}</b>: {t('assembly_method_authorized_any_desc', 'Varias personas estan autorizadas pero CUALQUIERA de ellas puede aprobar por si sola. No necesitan firmar todos. Diferente de multi-firma donde todos deben firmar.')}</li>
              <li><b>{t('assembly_method_organization', 'Organizacion')}</b>: {t('assembly_method_organization_desc', 'Delega la aprobacion a una organizacion (cooperativa, comite, etc). La organizacion tendra sus propios ajustes internos para decidir quien firma por ella.')}</li>
              <li><b>{t('assembly_method_multisig', 'Multi-firma')}</b>: {t('assembly_method_multisig_desc', 'Varias personas u organizaciones especificas deben firmar TODAS. Se aprueba solo cuando se alcanza el numero de firmas requerido. Selecciona exactamente QUIENES pueden firmar (personas y/o organizaciones).')}</li>
            </ul>
            <p>{t('assembly_quorum_desc', 'El')} <b>{t('assembly_quorum', 'quorum')}</b> {t('assembly_quorum_desc2', 'es el numero minimo de miembros que deben votar para que la decision sea valida. Si es 0, no hay minimo.')}</p>
            <p><strong>{t('assembly_method_advice_title', 'Consejo sobre que metodo usar:')}</strong> {t('assembly_method_advice_desc', 'Para cosas rutinarias (aprobar/desaprobar productos) usa Junta Directiva o Persona especifica. Para cosas graves (eliminar productos, expulsar miembros, cambiar impuestos) usa Asamblea con umbral alto (66.67% o mas).')}</p>
          </div>

          {assemblyConfigs.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <p>{t('no_config_loaded', 'No hay configuracion cargada.')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assemblyConfigs.map((cfg: any) => {
                const methodLabels: Record<string, string> = {
                  assembly: t('assembly_method_assembly_short', 'Asamblea'),
                  board: t('assembly_method_board', 'Junta Directiva'),
                  council: t('assembly_method_council', 'Comision/Departamento'),
                  multisig: t('assembly_method_multisig_all', 'Multi-firma (todas)'),
                  person: t('assembly_method_person', 'Persona especifica'),
                  authorized_any: t('assembly_method_authorized_any_short', 'Cualquiera autorizado'),
                  organization: t('assembly_method_organization', 'Organizacion'),
                }
                const methodLabel = methodLabels[cfg.approval_method] || cfg.approval_method
                return (
                <div key={cfg.id} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <b className="text-sm">{String(t(PROPOSAL_LABEL_KEYS[cfg.proposal_type as ProposalType] || '', cfg.proposal_type))}</b>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{methodLabel}</span>
                      </div>
                      {cfg.description && <p className="text-xs text-gray-500 mt-1">{cfg.description}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-gray-600 flex-wrap">
                        {(cfg.approval_method === 'assembly' || cfg.approval_method === 'board' || cfg.approval_method === 'organization') && (
                          <span>{t('assembly_percentage', 'Porcentaje:')} <b>{cfg.required_percentage}%</b></span>
                        )}
                        {(cfg.approval_method === 'assembly' || cfg.approval_method === 'board' || cfg.approval_method === 'organization') && (
                          <span>{t('assembly_quorum_label', 'Quorum:')} <b>{cfg.required_quorum}</b></span>
                        )}
                        {cfg.approval_method === 'multisig' && <span>{t('assembly_required_signatures', 'Firmas requeridas:')} <b>{cfg.required_signatures}</b></span>}
                        {cfg.approval_method === 'council' && cfg.council_name && (
                          <span>{t('assembly_council_label', 'Comision:')} <b>{cfg.council_name}</b></span>
                        )}
                        {cfg.approval_method === 'person' && cfg.authorized_person_name && (
                          <span>{t('assembly_person_label', 'Persona:')} <b>{cfg.authorized_person_name}</b></span>
                        )}
                        {cfg.approval_method === 'organization' && cfg.organization_name && (
                          <span>{t('assembly_org_label', 'Organizacion:')} <b>{cfg.organization_name}</b></span>
                        )}
                        {cfg.approval_method === 'multisig' && cfg.signers && cfg.signers.length > 0 && (
                          <span>{t('assembly_authorized_label', 'Autorizados:')} <b>{cfg.signers.map((s: any) => s.user_name || s.org_name).join(', ')}</b></span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingConfig(editingConfig?.id === cfg.id ? null : { ...cfg, signers: cfg.signers || [] })}
                      className="text-blue-500 hover:bg-blue-50 p-2 rounded text-sm"
                    >
                      {t('common:edit')}
                    </button>
                  </div>
                  {editingConfig?.id === cfg.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      {/* Metodo de aprobacion con ayuda */}
                      <div>
                        <label className="label flex items-center gap-1">
                          {t('assembly_approval_method', 'Metodo de aprobacion')}
                          <span className="text-blue-500 cursor-help" title={t('assembly_approval_method_help', 'Define quien toma la decision para este tipo de propuesta. Cada metodo tiene diferentes caracteristicas de velocidad y seguridad.')}>
                            <HelpCircle size={14} />
                          </span>
                        </label>
                        <select
                          className="input"
                          value={editingConfig.approval_method}
                          onChange={(e) => setEditingConfig({ ...editingConfig, approval_method: e.target.value })}
                        >
                          <option value="assembly">{t('assembly_opt_assembly', 'Asamblea (votacion de todos)')}</option>
                          <option value="board">{t('assembly_opt_board', 'Junta Directiva (mas rapido)')}</option>
                          <option value="council">{t('assembly_opt_council', 'Comision/Departamento (especializado)')}</option>
                          <option value="person">{t('assembly_opt_person', 'Persona especifica (mas rapido)')}</option>
                          <option value="authorized_any">{t('assembly_opt_authorized_any', 'Cualquiera de los autorizados (rapido)')}</option>
                          <option value="organization">{t('assembly_opt_organization', 'Organizacion (delegado)')}</option>
                          <option value="multisig">{t('assembly_opt_multisig', 'Multi-firma (todas deben firmar)')}</option>
                        </select>
                        <div className="text-xs text-gray-500 mt-1 bg-blue-50 p-2 rounded">
                          {editingConfig.approval_method === 'assembly' && t('assembly_help_assembly', 'Asamblea: Todos los miembros con derecho a voto votan. Es el metodo mas democratico pero el mas lento. Ideal para decisiones graves como cambiar impuestos o expulsar miembros.')}
                          {editingConfig.approval_method === 'board' && t('assembly_help_board', 'Junta Directiva: Solo los miembros de la junta directiva votan. Mas rapido que la asamblea. Ideal para decisiones administrativas del dia a dia como aprobar productos.')}
                          {editingConfig.approval_method === 'council' && t('assembly_help_council', 'Comision/Departamento: Una comision o departamento especifico decide. Ideal para decisiones tecnicas que requieren conocimiento especializado. Selecciona cual comision abajo.')}
                          {editingConfig.approval_method === 'person' && t('assembly_help_person', 'Persona especifica: Una sola persona autorizada aprueba. Es el metodo mas rapido. Ideal para decisiones rutinarias. Selecciona quien es la persona abajo.')}
                          {editingConfig.approval_method === 'authorized_any' && t('assembly_help_authorized_any', 'Cualquiera de los autorizados: Varias personas estan autorizadas pero CUALQUIERA de ellas puede aprobar por si sola. No necesitan firmar todos. Ideal cuando quieres delegar a varias personas pero basta con que una actue.')}
                          {editingConfig.approval_method === 'organization' && t('assembly_help_organization', 'Organizacion: Delega la aprobacion a una organizacion (cooperativa, comite). La organizacion tendra sus propios ajustes internos para decidir quien firma por ella.')}
                          {editingConfig.approval_method === 'multisig' && t('assembly_help_multisig', 'Multi-firma: Varias personas u organizaciones especificas deben firmar TODAS. Se aprueba solo cuando se alcanza el numero de firmas requerido. Diferente de "cualquiera autorizado" porque aqui TODOS deben firmar.')}
                        </div>
                      </div>

                      {/* Campos para Asamblea */}
                      {editingConfig.approval_method === 'assembly' && (
                        <>
                          <div>
                            <label className="label flex items-center gap-1">
                              {t('assembly_required_percentage', 'Porcentaje requerido (%)')}
                              <span className="text-blue-500 cursor-help" title={t('assembly_percentage_help', 'Porcentaje de votos a favor necesarios para aprobar. 50% = mayoria simple (mas de la mitad). 66.67% = dos tercios. 75% = tres cuartos. 100% = unanimidad (todos deben estar de acuerdo).')}>
                                <HelpCircle size={14} />
                              </span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              value={editingConfig.required_percentage}
                              onChange={(e) => setEditingConfig({ ...editingConfig, required_percentage: parseFloat(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-gray-400 mt-1">{t('assembly_percentage_hint', '50 = mayoria simple. 66.67 = 2/3. 75 = 3/4. 100 = unanimidad.')}</p>
                          </div>
                          <div>
                            <label className="label flex items-center gap-1">
                              {t('assembly_min_quorum_voters', 'Quorum minimo (numero de votantes)')}
                              <span className="text-blue-500 cursor-help" title={t('assembly_quorum_voters_help', 'Numero minimo de miembros que deben votar para que la decision sea valida. Si ponen 0, no hay minimo y basta con que vote una sola persona. Si ponen 10, al menos 10 miembros deben votar.')}>
                                <HelpCircle size={14} />
                              </span>
                            </label>
                            <input
                              type="number"
                              className="input"
                              value={editingConfig.required_quorum}
                              onChange={(e) => setEditingConfig({ ...editingConfig, required_quorum: parseInt(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-gray-400 mt-1">{t('assembly_quorum_voters_hint', 'Minimo de miembros que deben votar. 0 = sin minimo.')}</p>
                          </div>
                        </>
                      )}

                      {/* Campos para Junta Directiva */}
                      {editingConfig.approval_method === 'board' && (
                        <>
                          <div>
                            <label className="label flex items-center gap-1">
                              {t('assembly_required_percentage', 'Porcentaje requerido (%)')}
                              <span className="text-blue-500 cursor-help" title={t('assembly_board_percentage_help', 'Porcentaje de votos a favor de la junta directiva necesarios para aprobar. 50% = mayoria simple de la junta.')}>
                                <HelpCircle size={14} />
                              </span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              value={editingConfig.required_percentage}
                              onChange={(e) => setEditingConfig({ ...editingConfig, required_percentage: parseFloat(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-gray-400 mt-1">{t('assembly_board_percentage_hint', '50 = mayoria simple de la junta. 66.67 = 2/3 de la junta.')}</p>
                          </div>
                          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                            {t('assembly_board_config_note', 'La junta directiva se configura en la seccion "Junta Directiva" de esta pagina. Los miembros activos de la junta podran votar.')}
                          </div>
                        </>
                      )}

                      {/* Campos para Comision/Departamento */}
                      {editingConfig.approval_method === 'council' && (
                        <div>
                          <label className="label flex items-center gap-1">
                            {t('assembly_council_that_decides', 'Comision/Departamento que decide')}
                            <span className="text-blue-500 cursor-help" title={t('assembly_council_help', 'Selecciona cual comision o departamento sera responsable de aprobar este tipo de propuesta. Las comisiones se crean en la seccion de Departamentos. Solo los miembros de la comision podran votar.')}>
                              <HelpCircle size={14} />
                            </span>
                          </label>
                          <select
                            className="input"
                            value={editingConfig.council_id || ''}
                            onChange={(e) => setEditingConfig({ ...editingConfig, council_id: e.target.value })}
                          >
                            <option value="">{t('assembly_select_council', 'Seleccionar comision...')}</option>
                            {departments.map((d: any) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          {departments.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">{t('assembly_no_councils', 'No hay comisiones/departamentos creados. Crea uno en la seccion de Departamentos primero.')}</p>
                          )}
                          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded mt-2">
                            {t('assembly_council_desc', 'Una comision es un grupo de personas con conocimiento especializado en un area. Por ejemplo, una "Comision de Economia" podria aprobar cambios de precios, o una "Comision de Admisiones" podria aprobar nuevos miembros.')}
                          </div>
                        </div>
                      )}

                      {/* Campos para Persona especifica */}
                      {editingConfig.approval_method === 'person' && (
                        <div>
                          <label className="label flex items-center gap-1">
                            {t('assembly_authorized_person', 'Persona autorizada')}
                            <span className="text-blue-500 cursor-help" title={t('assembly_authorized_person_help', 'Selecciona la persona que tendra autoridad para aprobar o rechazar este tipo de propuesta por si sola, sin necesidad de votacion.')}>
                              <HelpCircle size={14} />
                            </span>
                          </label>
                          <select
                            className="input"
                            value={editingConfig.authorized_person_id || ''}
                            onChange={(e) => setEditingConfig({ ...editingConfig, authorized_person_id: e.target.value })}
                          >
                            <option value="">{t('assembly_select_person', 'Seleccionar persona...')}</option>
                            {userList.map((u: any) => (
                              <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
                            ))}
                          </select>
                          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded mt-2">
                            {t('assembly_person_method_desc', 'Esta persona podra aprobar o rechazar propuestas de este tipo por si sola. Es el metodo mas rapido pero concentra poder en una sola persona. Usalo solo para decisiones rutinarias de baja riesgo.')}
                          </div>
                        </div>
                      )}

                      {/* Campos para Organizacion */}
                      {editingConfig.approval_method === 'organization' && (
                        <>
                          <div>
                            <label className="label flex items-center gap-1">
                              {t('assembly_org_that_decides', 'Organizacion que decide')}
                              <span className="text-blue-500 cursor-help" title={t('assembly_org_help', 'Selecciona la organizacion a la que se delegara la aprobacion. La organizacion tendra sus propios ajustes para decidir internamente quien firma por ella.')}>
                                <HelpCircle size={14} />
                              </span>
                            </label>
                            <select
                              className="input"
                              value={editingConfig.organization_id || ''}
                              onChange={(e) => setEditingConfig({ ...editingConfig, organization_id: e.target.value })}
                            >
                              <option value="">{t('assembly_select_org', 'Seleccionar organizacion...')}</option>
                              {orgList.map((o: any) => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                              ))}
                            </select>
                            {orgList.length === 0 && (
                              <p className="text-xs text-amber-600 mt-1">{t('assembly_no_orgs_created', 'No hay organizaciones creadas.')}</p>
                            )}
                          </div>
                          <div>
                            <label className="label flex items-center gap-1">
                              {t('assembly_org_percentage', 'Porcentaje requerido dentro de la organizacion (%)')}
                              <span className="text-blue-500 cursor-help" title={t('assembly_org_percentage_help', 'Porcentaje de votos a favor dentro de la organizacion para que la aprobacion sea valida.')}>
                                <HelpCircle size={14} />
                              </span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              className="input"
                              value={editingConfig.required_percentage}
                              onChange={(e) => setEditingConfig({ ...editingConfig, required_percentage: parseFloat(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-gray-400 mt-1">{t('assembly_org_percentage_hint', '50 = mayoria simple de la organizacion.')}</p>
                          </div>
                          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                            {t('assembly_org_internal_note', 'La organizacion tendra sus propios ajustes internos para decidir quien puede firmar por ella. Esto se configura dentro de la organizacion.')}
                          </div>
                        </>
                      )}

                      {/* Campos para Multi-firma */}
                      {editingConfig.approval_method === 'multisig' && (
                        <>
                          <div>
                            <label className="label flex items-center gap-1">
                              {t('assembly_required_signatures_label', 'Firmas requeridas')}
                              <span className="text-blue-500 cursor-help" title={t('assembly_signatures_help', 'Numero de firmas necesarias para aprobar. Si pones 3, se necesitan 3 firmas de las personas/organizaciones autorizadas abajo. No puede ser mayor que el numero de autorizados.')}>
                                <HelpCircle size={14} />
                              </span>
                            </label>
                            <input
                              type="number"
                              className="input"
                              value={editingConfig.required_signatures}
                              onChange={(e) => setEditingConfig({ ...editingConfig, required_signatures: parseInt(e.target.value) || 1 })}
                            />
                            <p className="text-xs text-gray-400 mt-1">{t('assembly_signatures_hint', 'Cuantas firmas se necesitan de las personas/organizaciones autorizadas. Todas deben firmar.')}</p>
                          </div>
                          <div>
                            <label className="label flex items-center gap-1">
                              {t('assembly_authorized_signers', 'Personas/Organizaciones autorizadas para firmar')}
                              <span className="text-blue-500 cursor-help" title={t('assembly_signers_help', 'Lista de personas y/o organizaciones que tienen autoridad para firmar. Solo las personas/organizaciones de esta lista pueden firmar. Agrega o quita con los botones.')}>
                                <HelpCircle size={14} />
                              </span>
                            </label>
                            {/* Lista de signers actuales */}
                            {editingConfig.signers && editingConfig.signers.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {editingConfig.signers.map((s: any, i: number) => (
                                  <div key={s.id || i} className="flex items-center justify-between bg-gray-50 rounded p-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                        {s.signer_type === 'organization' ? t('assembly_org_short', 'Organizacion') : t('assembly_person_short', 'Persona')}
                                      </span>
                                      <span>{s.user_name || s.org_name || t('assembly_unknown', 'Desconocido')}</span>
                                    </div>
                                    <button
                                      onClick={() => setEditingConfig({
                                        ...editingConfig,
                                        signers: editingConfig.signers.filter((_: any, idx: number) => idx !== i),
                                      })}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Agregar nuevo signer */}
                            <div className="flex gap-2">
                              <select
                                className="input flex-shrink-0"
                                value={newSignerType}
                                onChange={(e) => { setNewSignerType(e.target.value as 'person' | 'organization'); setNewSignerId('') }}
                              >
                                <option value="person">{t('assembly_person_short', 'Persona')}</option>
                                <option value="organization">{t('assembly_org_short', 'Organizacion')}</option>
                              </select>
                              <select
                                className="input flex-1"
                                value={newSignerId}
                                onChange={(e) => setNewSignerId(e.target.value)}
                              >
                                <option value="">{t('assembly_select', 'Seleccionar...')}</option>
                                {newSignerType === 'person'
                                  ? userList.map((u: any) => (
                                      <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
                                    ))
                                  : orgList.map((o: any) => (
                                      <option key={o.id} value={o.id}>{o.name}</option>
                                    ))
                                }
                              </select>
                              <button
                                onClick={() => {
                                  if (!newSignerId) return
                                  const name = newSignerType === 'person'
                                    ? userList.find((u: any) => u.id === newSignerId)?.display_name || userList.find((u: any) => u.id === newSignerId)?.username
                                    : orgList.find((o: any) => o.id === newSignerId)?.name
                                  setEditingConfig({
                                    ...editingConfig,
                                    signers: [...(editingConfig.signers || []), {
                                      signer_type: newSignerType,
                                      user_id: newSignerType === 'person' ? newSignerId : '',
                                      organization_id: newSignerType === 'organization' ? newSignerId : '',
                                      user_name: newSignerType === 'person' ? name : '',
                                      org_name: newSignerType === 'organization' ? name : '',
                                    }],
                                  })
                                  setNewSignerId('')
                                }}
                                className="btn-secondary text-sm flex-shrink-0"
                              >
                                <Plus size={14} /> {t('assembly_add', 'Agregar')}
                              </button>
                            </div>
                            {(!editingConfig.signers || editingConfig.signers.length === 0) && (
                              <p className="text-xs text-amber-600 mt-1">{t('assembly_no_signers', 'No has agregado ningun firmante autorizado. Agrega al menos uno.')}</p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Campos para Cualquiera autorizado (authorized_any) */}
                      {editingConfig.approval_method === 'authorized_any' && (
                        <>
                          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                            {t('assembly_authorized_any_desc', 'Cualquiera de las personas autorizadas abajo puede aprobar este cambio por si sola. No necesitan firmar todos, basta con que una persona autorizada actue.')}
                          </div>
                          <div>
                            <label className="label flex items-center gap-1">
                              {t('assembly_authorized_persons', 'Personas autorizadas (cualquiera puede aprobar)')}
                              <span className="text-blue-500 cursor-help" title={t('assembly_authorized_persons_help', 'Lista de personas autorizadas. CUALQUIERA de ellas puede aprobar por si sola. No necesitan firmar todas. Diferente de multi-firma donde TODAS deben firmar.')}>
                                <HelpCircle size={14} />
                              </span>
                            </label>
                            {/* Lista de signers actuales */}
                            {editingConfig.signers && editingConfig.signers.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {editingConfig.signers.map((s: any, i: number) => (
                                  <div key={s.id || i} className="flex items-center justify-between bg-gray-50 rounded p-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                        {s.signer_type === 'organization' ? t('assembly_org_short', 'Organizacion') : t('assembly_person_short', 'Persona')}
                                      </span>
                                      <span>{s.user_name || s.org_name || t('assembly_unknown', 'Desconocido')}</span>
                                    </div>
                                    <button
                                      onClick={() => setEditingConfig({
                                        ...editingConfig,
                                        signers: editingConfig.signers.filter((_: any, idx: number) => idx !== i),
                                      })}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Agregar nuevo signer */}
                            <div className="flex gap-2">
                              <select
                                className="input flex-shrink-0"
                                value={newSignerType}
                                onChange={(e) => { setNewSignerType(e.target.value as 'person' | 'organization'); setNewSignerId('') }}
                              >
                                <option value="person">{t('assembly_person_short', 'Persona')}</option>
                                <option value="organization">{t('assembly_org_short', 'Organizacion')}</option>
                              </select>
                              <select
                                className="input flex-1"
                                value={newSignerId}
                                onChange={(e) => setNewSignerId(e.target.value)}
                              >
                                <option value="">{t('assembly_select', 'Seleccionar...')}</option>
                                {newSignerType === 'person'
                                  ? userList.map((u: any) => (
                                      <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
                                    ))
                                  : orgList.map((o: any) => (
                                      <option key={o.id} value={o.id}>{o.name}</option>
                                    ))
                                }
                              </select>
                              <button
                                onClick={() => {
                                  if (!newSignerId) return
                                  const name = newSignerType === 'person'
                                    ? userList.find((u: any) => u.id === newSignerId)?.display_name || userList.find((u: any) => u.id === newSignerId)?.username
                                    : orgList.find((o: any) => o.id === newSignerId)?.name
                                  setEditingConfig({
                                    ...editingConfig,
                                    signers: [...(editingConfig.signers || []), {
                                      signer_type: newSignerType,
                                      user_id: newSignerType === 'person' ? newSignerId : '',
                                      organization_id: newSignerType === 'organization' ? newSignerId : '',
                                      user_name: newSignerType === 'person' ? name : '',
                                      org_name: newSignerType === 'organization' ? name : '',
                                    }],
                                  })
                                  setNewSignerId('')
                                }}
                                className="btn-secondary text-sm flex-shrink-0"
                              >
                                <Plus size={14} /> {t('assembly_add', 'Agregar')}
                              </button>
                            </div>
                            {(!editingConfig.signers || editingConfig.signers.length === 0) && (
                              <p className="text-xs text-amber-600 mt-1">{t('assembly_no_authorized_persons', 'No has agregado ninguna persona autorizada. Agrega al menos una.')}</p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Descripcion */}
                      <div>
                        <label className="label flex items-center gap-1">
                          {t('assembly_description_label', 'Descripcion')}
                          <span className="text-blue-500 cursor-help" title={t('assembly_description_help', 'Texto descriptivo que explica que hace este tipo de propuesta. Aparece debajo del titulo para ayudar a entender de que se trata.')}>
                            <HelpCircle size={14} />
                          </span>
                        </label>
                        <input
                          className="input"
                          value={editingConfig.description || ''}
                          onChange={(e) => setEditingConfig({ ...editingConfig, description: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await api.put(`/assembly/config/${cfg.proposal_type}`, {
                                approval_method: editingConfig.approval_method,
                                required_percentage: editingConfig.required_percentage,
                                required_quorum: editingConfig.required_quorum,
                                required_signatures: editingConfig.required_signatures,
                                council_id: editingConfig.council_id || '',
                                authorized_person_id: editingConfig.authorized_person_id || '',
                                organization_id: editingConfig.organization_id || '',
                                description: editingConfig.description,
                                signers: (editingConfig.signers || []).map((s: any) => ({
                                  signer_type: s.signer_type,
                                  user_id: s.user_id || '',
                                  organization_id: s.organization_id || '',
                                })),
                              })
                              setEditingConfig(null)
                              setNewSignerId('')
                              load()
                            } catch (err) {
                              setError(err instanceof Error ? err.message : t('error_save_config'))
                            }
                          }}
                          className="btn-primary text-sm"
                        >
                          {t('common:save')}
                        </button>
                        <button onClick={() => { setEditingConfig(null); setNewSignerId('') }} className="btn-secondary text-sm">{t('common:cancel')}</button>
                      </div>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* Modal para abrir votacion - la asamblea decide duracion y modo */}
      {votingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">{t('assembly_open_voting', 'Abrir votacion')}</h2>
              <button onClick={() => setVotingModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">{votingModal.title}</p>

              <div>
                <label className="block text-sm font-medium mb-2">{t('assembly_voting_mode', 'Modo de votacion')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setVotingMode('presencial'); setVotingDuration(10) }}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${votingMode === 'presencial' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}
                  >
                    {t('assembly_presential', 'Presencial')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setVotingMode('remoto'); setVotingDuration(1440) }}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${votingMode === 'remoto' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
                  >
                    {t('assembly_remote', 'Remoto')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('assembly_voting_duration', 'Duracion del voto')}</label>
                <select
                  value={votingDuration}
                  onChange={e => setVotingDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {votingMode === 'presencial' ? (
                    <>
                      <option value={5}>5 {t('assembly_minutes', 'minutos')}</option>
                      <option value={10}>10 {t('assembly_minutes', 'minutos')}</option>
                      <option value={15}>15 {t('assembly_minutes', 'minutos')}</option>
                      <option value={30}>30 {t('assembly_minutes_extended', 'minutos (discusion extendida)')}</option>
                    </>
                  ) : (
                    <>
                      <option value={60}>1 {t('assembly_hour', 'hora')}</option>
                      <option value={360}>6 {t('assembly_hours', 'horas')}</option>
                      <option value={1440}>24 {t('assembly_hours', 'horas')}</option>
                      <option value={4320}>3 {t('assembly_days', 'dias')}</option>
                      <option value={10080}>7 {t('assembly_days_prolonged', 'dias (consulta prolongada)')}</option>
                    </>
                  )}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {votingMode === 'presencial'
                    ? t('assembly_presential_voting_desc', 'Votacion durante la asamblea presencial. Cuando se venza el tiempo, se cuentan los votos.')
                    : t('assembly_remote_voting_desc', 'Votacion remota: los miembros pueden votar desde cualquier lugar. Cuando se venza el tiempo, la propuesta se rechaza si no hay quorum.')}
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setVotingModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  {t('common:cancel')}
                </button>
                <button
                  onClick={() => openVoting(votingModal.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  {t('assembly_open_voting_btn', 'Abrir votacion')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles de propuesta */}
      {showProposalDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProposalDetail(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{t('assembly_proposal_details', 'Detalles de la propuesta')}</h3>
              <button onClick={() => setShowProposalDetail(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">{t('assembly_type_label', 'Tipo:')}:</span>{' '}
                <span className="font-medium">{String(t(PROPOSAL_LABEL_KEYS[showProposalDetail.proposal_type as ProposalType] || '', showProposalDetail.proposal_type))}</span>
              </div>

              <div>
                <span className="text-gray-500">{t('assembly_status_label', 'Estado:')}:</span>{' '}
                <span className="font-medium">{showProposalDetail.status === 'expired' ? t('assembly_status_expired', 'vencida') : showProposalDetail.status === 'pending' ? t('assembly_status_voting', 'en votacion') : showProposalDetail.status === 'approved' ? t('assembly_status_approved', 'aprobada') : showProposalDetail.status === 'executed' ? t('assembly_status_executed', 'ejecutada') : showProposalDetail.status === 'rejected' ? t('assembly_status_rejected', 'rechazada') : showProposalDetail.status === 'proposed' ? t('assembly_status_proposed', 'pendiente de revision') : showProposalDetail.status}</span>
              </div>

              {showProposalDetail.created_at && (
                <div>
                  <span className="text-gray-500">{t('assembly_creation_date', 'Fecha de creacion:')}:</span>{' '}
                  <span className="font-medium">{fmtDateTime(showProposalDetail.created_at)}</span>
                </div>
              )}

              {showProposalDetail.title && (
                <div>
                  <span className="text-gray-500">{t('assembly_title_label', 'Titulo:')}:</span>{' '}
                  <span className="font-medium">{showProposalDetail.title}</span>
                </div>
              )}

              <div>
                <span className="text-gray-500 block mb-1">{t('assembly_description_label', 'Descripcion:')}:</span>
                <p className="text-gray-700 whitespace-pre-wrap">{showProposalDetail.description}</p>
              </div>

              {/* Parametros de la propuesta */}
              {showProposalDetail.parameters && Object.keys(showProposalDetail.parameters).length > 0 && (
                <div>
                  <span className="text-gray-500 block mb-1">{t('assembly_parameters', 'Parametros:')}:</span>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    {Object.entries(showProposalDetail.parameters).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-gray-500">{key}:</span>
                        <span className="font-medium text-right">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Respuestas del formulario de admision */}
              {showProposalDetail.form_responses && (
                <div>
                  <span className="text-gray-500 block mb-1">{t('assembly_form_responses', 'Respuestas del formulario:')}:</span>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    {typeof showProposalDetail.form_responses === 'string' ? (
                      <p className="text-gray-700 whitespace-pre-wrap">{showProposalDetail.form_responses}</p>
                    ) : Object.keys(showProposalDetail.form_responses).length > 0 ? (
                      Object.entries(showProposalDetail.form_responses).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-gray-500">{key}:</span>
                          <span className="font-medium text-right">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 italic text-xs">{t('assembly_no_responses', 'Sin respuestas')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata adicional */}
              {showProposalDetail.metadata && (
                <div>
                  <span className="text-gray-500 block mb-1">{t('assembly_metadata', 'Metadata:')}:</span>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    {typeof showProposalDetail.metadata === 'string' ? (
                      <p className="text-gray-700 whitespace-pre-wrap">{showProposalDetail.metadata}</p>
                    ) : Object.keys(showProposalDetail.metadata).length > 0 ? (
                      Object.entries(showProposalDetail.metadata).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-gray-500">{key}:</span>
                          <span className="font-medium text-right">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 italic text-xs">{t('assembly_no_metadata', 'Sin metadata')}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Votos (si aplica) */}
              {(showProposalDetail.votes_for != null || showProposalDetail.votes_against != null || showProposalDetail.votes_abstain != null) && (
                <div>
                  <span className="text-gray-500 block mb-1">{t('assembly_votes', 'Votos:')}:</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 font-medium">{t('assembly_in_favor', 'A favor:')} {showProposalDetail.votes_for || 0}</span>
                    <span className="text-red-600 font-medium">{t('assembly_against', 'En contra:')} {showProposalDetail.votes_against || 0}</span>
                    <span className="text-gray-500 font-medium">{t('assembly_abstention', 'Abstencion:')} {showProposalDetail.votes_abstain || 0}</span>
                  </div>
                </div>
              )}

              {/* Cualquier otro campo disponible */}
              {Object.entries(showProposalDetail)
                .filter(([k]: [string, any]) => !['id', 'proposal_type', 'status', 'created_at', 'title', 'description', 'parameters', 'form_responses', 'metadata', 'votes_for', 'votes_against', 'votes_abstain', 'votes_not_cast', 'total_voting_members', 'voting_deadline', 'created_by'].includes(k))
                .map(([key, value]: [string, any]) => (
                  <div key={key}>
                    <span className="text-gray-500">{key}:</span>{' '}
                    <span className="font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                  </div>
                ))}
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setShowProposalDetail(null)} className="btn-secondary">
                {t('common:close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente para editar configuracion de quorum por tipo de asamblea
function QuorumConfigCard({ config, onSave }: { config: any; onSave: (sessionType: string, data: any) => void }) {
  const { t } = useTranslation(['assembly', 'common'])
  const [editing, setEditing] = useState(false)
  const [firstCall, setFirstCall] = useState(config.quorum_first_call)
  const [secondCall, setSecondCall] = useState(config.quorum_second_call)
  const [graceHours, setGraceHours] = useState(config.grace_period_hours)
  const [maxRecall, setMaxRecall] = useState(config.max_recall_count)
  const [allowReschedule, setAllowReschedule] = useState(config.allow_reschedule)

  const sessionTypeLabel: Record<string, string> = {
    ordinaria: t('assembly_ordinary', 'Asamblea Ordinaria'),
    extraordinaria: t('assembly_extraordinary', 'Asamblea Extraordinaria'),
    urgente: t('assembly_urgent', 'Asamblea Urgente'),
  }

  const isBoard = config.meeting_type === 'board'
  const prefix = isBoard ? t('assembly_board_prefix', 'Junta ') : t('assembly_assembly_prefix', 'Asamblea ')
  const label = (sessionTypeLabel[config.session_type] || config.session_type).replace(t('assembly_assembly_prefix'), prefix)

  return (
    <div className={`card ${isBoard ? 'border-purple-200' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <b className="text-sm">{label}</b>
          {isBoard && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{t('assembly_board_directive', 'Junta Directiva')}</span>}
          <div className="flex gap-4 mt-1 text-xs text-gray-600">
            <span>{t('assembly_first_call', '1er llamado:')} <b>{config.quorum_first_call}%</b></span>
            <span>{t('assembly_second_call_label', '2do llamado:')} <b>{config.quorum_second_call}%</b></span>
            <span>{t('assembly_grace', 'Gracia:')} <b>{config.grace_period_hours}h</b></span>
            <span>{t('assembly_max_reschedules', 'Max. reprogramaciones:')} <b>{config.max_recall_count}</b></span>
          </div>
        </div>
        <button onClick={() => setEditing(!editing)} className="text-blue-500 hover:bg-blue-50 p-2 rounded text-sm">
          {editing ? t('common:close') : t('common:edit')}
        </button>
      </div>
      {editing && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('assembly_quorum_first_call_pct', 'Quorum 1er llamado (%)')}</label>
              <input type="number" step="0.01" min="0" max="100" className="input" value={firstCall} onChange={e => setFirstCall(parseFloat(e.target.value))} />
              <p className="text-xs text-gray-400">{t('assembly_quorum_first_call_hint', 'Porcentaje para la fecha original')}</p>
            </div>
            <div>
              <label className="label">{t('assembly_quorum_second_call_pct', 'Quorum 2do llamado (%)')}</label>
              <input type="number" step="0.01" min="0" max="100" className="input" value={secondCall} onChange={e => setSecondCall(parseFloat(e.target.value))} />
              <p className="text-xs text-gray-400">{t('assembly_quorum_second_call_hint', 'Porcentaje reducido si se reprograma')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('assembly_grace_period_hours', 'Periodo de gracia (horas)')}</label>
              <input type="number" min="0" max="24" className="input" value={graceHours} onChange={e => setGraceHours(parseInt(e.target.value))} />
              <p className="text-xs text-gray-400">{t('assembly_grace_hint', 'Horas que se espera antes de cancelar')}</p>
            </div>
            <div>
              <label className="label">{t('assembly_max_reschedules_label', 'Max. reprogramaciones')}</label>
              <input type="number" min="0" max="5" className="input" value={maxRecall} onChange={e => setMaxRecall(parseInt(e.target.value))} />
              <p className="text-xs text-gray-400">{t('assembly_max_reschedules_hint', 'Cuantas veces se puede reprogramar')}</p>
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowReschedule} onChange={e => setAllowReschedule(e.target.checked)} className="accent-trueque-600" />
            <span className="text-sm">{t('assembly_allow_reschedule', 'Permitir reprogramar si no hay quorum')}</span>
          </label>
          <button
            onClick={() => {
              onSave(config.session_type, {
                quorum_first_call: firstCall,
                quorum_second_call: secondCall,
                grace_period_hours: graceHours,
                max_recall_count: maxRecall,
                allow_reschedule: allowReschedule,
              })
              setEditing(false)
            }}
            className="btn-primary text-sm"
          >
            {t('common:save')}
          </button>
        </div>
      )}
    </div>
  )
}
