export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          debt_id: string
          id: string
          kind: string
          notes: string | null
          payment_date: string
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          debt_id: string
          id?: string
          kind?: string
          notes?: string | null
          payment_date?: string
          shop_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          debt_id?: string
          id?: string
          kind?: string
          notes?: string | null
          payment_date?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string | null
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date: string | null
          id: string
          notes: string | null
          paid_amount: number
          person_name: string
          phone: string | null
          settled_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["debt_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          currency?: string | null
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          person_name: string
          phone?: string | null
          settled_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string | null
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          person_name?: string
          phone?: string | null
          settled_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["debt_status"]
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          shop_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          shop_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          shop_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          description: string | null
          expense_date: string
          id: string
          paid_to: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_url: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          expense_date?: string
          id?: string
          paid_to?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          expense_date?: string
          id?: string
          paid_to?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes: string | null
          product_id: string | null
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          shop_id: string
          stock_after: number | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          product_id?: string | null
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          shop_id: string
          stock_after?: number | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          shop_id?: string
          stock_after?: number | null
          variant_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          environment: string
          id: string
          order_id: string
          paid_at: string | null
          plan_code: string
          raw_event: Json | null
          shop_id: string
          status: string
          tracker: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          order_id: string
          paid_at?: string | null
          plan_code: string
          raw_event?: Json | null
          shop_id: string
          status?: string
          tracker: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          plan_code?: string
          raw_event?: Json | null
          shop_id?: string
          status?: string
          tracker?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          duration_days: number
          id: string
          is_active: boolean
          name: string
          price: number
          savings_label: string | null
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          duration_days: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          savings_label?: string | null
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          savings_label?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          is_active: boolean
          low_stock_threshold: number
          name: string
          price_override: number | null
          product_id: string
          shop_id: string
          sku: string | null
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          price_override?: number | null
          product_id: string
          shop_id: string
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          price_override?: number | null
          product_id?: string
          shop_id?: string
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          low_stock_threshold: number
          name: string
          price: number
          shop_id: string
          sku: string | null
          stock: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          price?: number
          shop_id: string
          sku?: string | null
          stock?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          price?: number
          shop_id?: string
          sku?: string | null
          stock?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          must_change_password: boolean
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          must_change_password?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          must_change_password?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string | null
          product_name: string
          purchase_id: string
          quantity: number
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          product_id?: string | null
          product_name: string
          purchase_id: string
          quantity: number
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string
          purchase_id?: string
          quantity?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invoice_image_url: string | null
          notes: string | null
          paid_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference_number: string | null
          shop_id: string
          subtotal: number
          supplier_id: string | null
          tax: number
          total: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invoice_image_url?: string | null
          notes?: string | null
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference_number?: string | null
          shop_id: string
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_image_url?: string | null
          notes?: string | null
          paid_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference_number?: string | null
          shop_id?: string
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          product_id?: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_notifications: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          kind: string
          provider_sid: string | null
          sale_id: string
          shop_id: string
          status: string
          to_address: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          provider_sid?: string | null
          sale_id: string
          shop_id: string
          status?: string
          to_address: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          provider_sid?: string | null
          sale_id?: string
          shop_id?: string
          status?: string
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_notifications_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_return_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string | null
          product_name: string
          quantity: number
          return_id: string
          sale_item_id: string | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          product_id?: string | null
          product_name: string
          quantity: number
          return_id: string
          sale_item_id?: string | null
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          return_id?: string
          sale_item_id?: string | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          processed_by: string
          reason: string | null
          refund_method: Database["public"]["Enums"]["payment_method"]
          return_number: string | null
          sale_id: string
          shop_id: string
          total_refund: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_by: string
          reason?: string | null
          refund_method?: Database["public"]["Enums"]["payment_method"]
          return_number?: string | null
          sale_id: string
          shop_id: string
          total_refund?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_by?: string
          reason?: string | null
          refund_method?: Database["public"]["Enums"]["payment_method"]
          return_number?: string | null
          sale_id?: string
          shop_id?: string
          total_refund?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          cashier_id: string
          change_due: number
          created_at: string
          customer_id: string | null
          discount: number
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_number: string | null
          shop_id: string
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          amount_paid?: number
          cashier_id: string
          change_due?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_number?: string | null
          shop_id: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          amount_paid?: number
          cashier_id?: string
          change_due?: number
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_number?: string | null
          shop_id?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          shop_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          shop_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_api_keys_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_custom_roles: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          name: string
          shop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          shop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_custom_roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          created_at: string
          disabled: boolean
          id: string
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled?: boolean
          id?: string
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          disabled?: boolean
          id?: string
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_role_permissions: {
        Row: {
          action: Database["public"]["Enums"]["permission_action"]
          id: string
          module: Database["public"]["Enums"]["app_module"]
          role_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["permission_action"]
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          role_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["permission_action"]
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "shop_custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_sync_settings: {
        Row: {
          created_at: string
          last_sync_at: string | null
          last_sync_status: string | null
          remote_api_key: string | null
          remote_base_url: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          remote_api_key?: string | null
          remote_base_url?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_sync_at?: string | null
          last_sync_status?: string | null
          remote_api_key?: string | null
          remote_base_url?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_sync_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_user_role_assignments: {
        Row: {
          created_at: string
          id: string
          role_id: string
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_user_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "shop_custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_user_role_assignments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          currency: string
          email: string | null
          id: string
          is_pro: boolean
          logo_url: string | null
          name: string
          notify_daily_summary: boolean
          notify_low_stock: boolean
          phone: string | null
          pro_until: string | null
          receipt_footer: string | null
          receipt_header: string | null
          show_tax_line: boolean
          tax_rate: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          currency?: string
          email?: string | null
          id?: string
          is_pro?: boolean
          logo_url?: string | null
          name: string
          notify_daily_summary?: boolean
          notify_low_stock?: boolean
          phone?: string | null
          pro_until?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          show_tax_line?: boolean
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          email?: string | null
          id?: string
          is_pro?: boolean
          logo_url?: string | null
          name?: string
          notify_daily_summary?: boolean
          notify_low_stock?: boolean
          phone?: string | null
          pro_until?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          show_tax_line?: boolean
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      supplier_return_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string | null
          product_name: string
          purchase_item_id: string | null
          quantity: number
          return_id: string
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          product_id?: string | null
          product_name: string
          purchase_item_id?: string | null
          quantity: number
          return_id: string
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string
          purchase_item_id?: string | null
          quantity?: number
          return_id?: string
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "supplier_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_returns: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          processed_by: string
          purchase_id: string
          reason: string | null
          refund_method: Database["public"]["Enums"]["payment_method"]
          return_number: string | null
          shop_id: string
          supplier_id: string | null
          total_refund: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_by: string
          purchase_id: string
          reason?: string | null
          refund_method?: Database["public"]["Enums"]["payment_method"]
          return_number?: string | null
          shop_id: string
          supplier_id?: string | null
          total_refund?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          processed_by?: string
          purchase_id?: string
          reason?: string | null
          refund_method?: Database["public"]["Enums"]["payment_method"]
          return_number?: string | null
          shop_id?: string
          supplier_id?: string | null
          total_refund?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_returns_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_applications: {
        Row: {
          business_name: string
          contact_email: string
          created_at: string
          id: string
          notes: string | null
          requested_slug: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          business_name: string
          contact_email: string
          created_at?: string
          id?: string
          notes?: string | null
          requested_slug: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          business_name?: string
          contact_email?: string
          created_at?: string
          id?: string
          notes?: string | null
          requested_slug?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          business_name: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          logo_url: string | null
          owner_id: string
          slug: string
        }
        Insert: {
          business_name: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          owner_id: string
          slug: string
        }
        Update: {
          business_name?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          owner_id?: string
          slug?: string
        }
        Relationships: []
      }
      web_cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          unit_price_cents: number
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          unit_price_cents: number
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_price_cents?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "web_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "web_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "web_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      web_carts: {
        Row: {
          created_at: string
          id: string
          session_id: string | null
          updated_at: string
          user_id: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_carts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      web_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_categories_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      web_collections: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_collections_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      web_customers: {
        Row: {
          created_at: string
          default_shipping_address: Json | null
          display_name: string | null
          id: string
          phone: string | null
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          default_shipping_address?: Json | null
          display_name?: string | null
          id?: string
          phone?: string | null
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          default_shipping_address?: Json | null
          display_name?: string | null
          id?: string
          phone?: string | null
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_customers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      web_order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_cents: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price_cents: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price_cents?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "web_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "web_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "web_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      web_orders: {
        Row: {
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_user_id: string | null
          id: string
          shipping_address: Json
          status: string
          subtotal_cents: number
          total_cents: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_user_id?: string | null
          id?: string
          shipping_address: Json
          status?: string
          subtotal_cents: number
          total_cents: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_user_id?: string | null
          id?: string
          shipping_address?: Json
          status?: string
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      web_product_images: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          position: number
          product_id: string
          url: string
          vendor_id: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id: string
          url: string
          vendor_id: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          url?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "web_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_product_images_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      web_product_variants: {
        Row: {
          created_at: string
          id: string
          name: string
          price_cents: number
          product_id: string
          sku: string | null
          stock: number
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price_cents?: number
          product_id: string
          sku?: string | null
          stock?: number
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price_cents?: number
          product_id?: string
          sku?: string | null
          stock?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "web_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_product_variants_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      web_products: {
        Row: {
          category_id: string | null
          collection_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_published: boolean
          name: string
          price_cents: number
          slug: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          category_id?: string | null
          collection_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
          price_cents?: number
          slug: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          category_id?: string | null
          collection_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
          price_cents?: number
          slug?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "web_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "web_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_pro_for_shop: {
        Args: { _duration_days: number; _shop_id: string }
        Returns: undefined
      }
      adjust_stock: {
        Args: {
          _delta: number
          _notes: string
          _product_id: string
          _reason: string
          _variant_id: string
        }
        Returns: number
      }
      admin_delete_shop: { Args: { _shop_id: string }; Returns: undefined }
      admin_delete_user: { Args: { _user_id: string }; Returns: undefined }
      admin_list_shops: {
        Args: never
        Returns: {
          created_at: string
          currency: string
          is_pro: boolean
          member_count: number
          name: string
          owner_email: string
          pro_until: string
          sales_count: number
          sales_total: number
          shop_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          is_blocked: boolean
          is_super_admin: boolean
          last_sign_in_at: string
          shop_count: number
          shop_roles: string
          user_id: string
        }[]
      }
      admin_overview_stats: {
        Args: never
        Returns: {
          pending_payments: number
          pro_shops: number
          total_revenue: number
          total_sales: number
          total_shops: number
          total_users: number
        }[]
      }
      admin_set_shop_pro: {
        Args: { _days?: number; _is_pro: boolean; _shop_id: string }
        Returns: undefined
      }
      admin_set_user_blocked: {
        Args: { _blocked: boolean; _user_id: string }
        Returns: undefined
      }
      current_vendor_id: { Args: never; Returns: string }
      delete_purchase: { Args: { _purchase_id: string }; Returns: undefined }
      delete_sale: { Args: { _sale_id: string }; Returns: undefined }
      delete_sale_return: { Args: { _return_id: string }; Returns: undefined }
      delete_supplier_return: {
        Args: { _return_id: string }
        Returns: undefined
      }
      find_email_by_username: { Args: { _username: string }; Returns: string }
      find_user_by_email: { Args: { _email: string }; Returns: string }
      get_user_shop_role: {
        Args: { _shop_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["shop_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shop_permission: {
        Args: {
          _action: Database["public"]["Enums"]["permission_action"]
          _module: Database["public"]["Enums"]["app_module"]
          _shop_id: string
          _uid: string
        }
        Returns: boolean
      }
      has_shop_role: {
        Args: {
          _roles: Database["public"]["Enums"]["shop_role"][]
          _shop_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_shop_member: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      replace_purchase_items: {
        Args: {
          _items: Json
          _notes: string
          _payment_method: Database["public"]["Enums"]["payment_method"]
          _purchase_id: string
          _reference_number: string
          _supplier_id: string
        }
        Returns: undefined
      }
      seed_default_shop_roles_for: {
        Args: { _shop_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_module:
        | "pos"
        | "products"
        | "sales"
        | "customers"
        | "suppliers"
        | "purchases"
        | "returns"
        | "expenses"
        | "debts"
        | "analytics"
        | "staff"
        | "settings"
      app_role: "super_admin" | "vendor" | "customer"
      debt_direction: "owed_to_me" | "i_owe"
      debt_status: "open" | "settled"
      inventory_movement_type:
        | "sale"
        | "sale_delete"
        | "purchase"
        | "purchase_delete"
        | "return"
        | "return_delete"
        | "adjustment"
        | "initial"
        | "supplier_return"
        | "supplier_return_delete"
      payment_method: "cash" | "card" | "mobile" | "other"
      payment_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "auto_verified"
      permission_action: "view" | "create" | "edit" | "delete"
      shop_role: "owner" | "manager" | "cashier"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_module: [
        "pos",
        "products",
        "sales",
        "customers",
        "suppliers",
        "purchases",
        "returns",
        "expenses",
        "debts",
        "analytics",
        "staff",
        "settings",
      ],
      app_role: ["super_admin", "vendor", "customer"],
      debt_direction: ["owed_to_me", "i_owe"],
      debt_status: ["open", "settled"],
      inventory_movement_type: [
        "sale",
        "sale_delete",
        "purchase",
        "purchase_delete",
        "return",
        "return_delete",
        "adjustment",
        "initial",
        "supplier_return",
        "supplier_return_delete",
      ],
      payment_method: ["cash", "card", "mobile", "other"],
      payment_request_status: [
        "pending",
        "approved",
        "rejected",
        "auto_verified",
      ],
      permission_action: ["view", "create", "edit", "delete"],
      shop_role: ["owner", "manager", "cashier"],
    },
  },
} as const
