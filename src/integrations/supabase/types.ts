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
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          path: string | null
          product_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          path?: string | null
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          path?: string | null
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_export_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          date_from: string | null
          date_to: string | null
          export_type: string
          id: string
          row_count: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          export_type: string
          id?: string
          row_count?: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          export_type?: string
          id?: string
          row_count?: number
        }
        Relationships: []
      }
      customer_analytics_snapshots: {
        Row: { created_at: string; id: string; metrics: Json; snapshot_date: string; user_id: string | null }
        Insert: { created_at?: string; id?: string; metrics?: Json; snapshot_date: string; user_id?: string | null }
        Update: { created_at?: string; id?: string; metrics?: Json; snapshot_date?: string; user_id?: string | null }
        Relationships: []
      }
      daily_analytics_snapshots: {
        Row: { created_at: string; metrics: Json; snapshot_date: string; updated_at: string }
        Insert: { created_at?: string; metrics?: Json; snapshot_date: string; updated_at?: string }
        Update: { created_at?: string; metrics?: Json; snapshot_date?: string; updated_at?: string }
        Relationships: []
      }
      product_analytics_snapshots: {
        Row: { created_at: string; id: string; metrics: Json; product_id: string | null; snapshot_date: string }
        Insert: { created_at?: string; id?: string; metrics?: Json; product_id?: string | null; snapshot_date: string }
        Update: { created_at?: string; id?: string; metrics?: Json; product_id?: string | null; snapshot_date?: string }
        Relationships: []
      }
      business_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      lookbook_items: {
        Row: {
          active: boolean
          caption: string
          created_at: string
          id: string
          image_url: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          caption?: string
          created_at?: string
          id?: string
          image_url: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          caption?: string
          created_at?: string
          id?: string
          image_url?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_library: {
        Row: {
          created_at: string
          folder: string
          id: string
          metadata: Json
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          folder?: string
          id?: string
          metadata?: Json
          mime_type?: string
          name: string
          size_bytes?: number
          storage_path: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          folder?: string
          id?: string
          metadata?: Json
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      inventory_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          movement_type: string
          new_stock: number | null
          note: string | null
          order_id: string | null
          previous_stock: number | null
          product_id: string
          quantity: number
          variant_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          movement_type: string
          new_stock?: number | null
          note?: string | null
          order_id?: string | null
          previous_stock?: number | null
          product_id: string
          quantity: number
          variant_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          movement_type?: string
          new_stock?: number | null
          note?: string | null
          order_id?: string | null
          previous_stock?: number | null
          product_id?: string
          quantity?: number
          variant_id?: string | null
        }
        Relationships: []
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          label: string
          order_id: string
          visible_to_customer: boolean
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          label: string
          order_id: string
          visible_to_customer?: boolean
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          label?: string
          order_id?: string
          visible_to_customer?: boolean
        }
        Relationships: []
      }
      shipment_events: {
        Row: {
          actor_id: string | null
          courier_name: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          status: string
          tracking_number: string | null
          tracking_url: string | null
          visible_to_customer: boolean
        }
        Insert: {
          actor_id?: string | null
          courier_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          status: string
          tracking_number?: string | null
          tracking_url?: string | null
          visible_to_customer?: boolean
        }
        Update: {
          actor_id?: string | null
          courier_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          visible_to_customer?: boolean
        }
        Relationships: []
      }
      shipping_methods: {
        Row: {
          base_fee: number
          created_at: string
          enabled: boolean
          estimated_days: string
          express_fee: number
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          base_fee?: number
          created_at?: string
          enabled?: boolean
          estimated_days?: string
          express_fee?: number
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          base_fee?: number
          created_at?: string
          enabled?: boolean
          estimated_days?: string
          express_fee?: number
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_providers: {
        Row: {
          created_at: string
          enabled: boolean
          key: string
          mode: string
          name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          key: string
          mode?: string
          name: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          key?: string
          mode?: string
          name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      shipping_rate_rules: {
        Row: {
          active: boolean
          created_at: string
          express_fee: number | null
          fee: number
          id: string
          max_subtotal: number | null
          min_subtotal: number
          name: string
          pincode_prefix: string | null
          shipping_class: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          express_fee?: number | null
          fee?: number
          id?: string
          max_subtotal?: number | null
          min_subtotal?: number
          name: string
          pincode_prefix?: string | null
          shipping_class?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          express_fee?: number | null
          fee?: number
          id?: string
          max_subtotal?: number | null
          min_subtotal?: number
          name?: string
          pincode_prefix?: string | null
          shipping_class?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          archived_at: string | null
          cancelled_at: string | null
          courier_name: string | null
          created_at: string
          customer_notes: string | null
          customer_name: string
          delivery_date: string | null
          discount_amount: number
          dispatch_date: string | null
          email: string | null
          estimated_delivery_date: string | null
          fragile: boolean
          id: string
          internal_notes: string | null
          items: Json
          operational_status: string
          order_number: string | null
          packaging_fee: number
          payment_method: string
          payment_expires_at: string | null
          payment_rejection_reason: string | null
          payment_screenshot_url: string | null
          payment_submitted_at: string | null
          payment_status: string
          payment_utr: string | null
          payment_verified_at: string | null
          phone: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          refund_reason: string | null
          refund_status: string | null
          shipment_label_metadata: Json
          shipping_fee: number
          shipping_mode: string
          shipping_notes: string | null
          shipping_provider: string
          shipping_status: string
          status: string
          stock_deducted_at: string | null
          subtotal_amount: number
          tax_amount: number
          tracking_number: string | null
          tracking_url: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          address: string
          archived_at?: string | null
          cancelled_at?: string | null
          courier_name?: string | null
          created_at?: string
          customer_notes?: string | null
          customer_name: string
          delivery_date?: string | null
          discount_amount?: number
          dispatch_date?: string | null
          email?: string | null
          estimated_delivery_date?: string | null
          fragile?: boolean
          id?: string
          internal_notes?: string | null
          items?: Json
          operational_status?: string
          order_number?: string | null
          packaging_fee?: number
          payment_method?: string
          payment_expires_at?: string | null
          payment_rejection_reason?: string | null
          payment_screenshot_url?: string | null
          payment_submitted_at?: string | null
          payment_status?: string
          payment_utr?: string | null
          payment_verified_at?: string | null
          phone: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          refund_reason?: string | null
          refund_status?: string | null
          shipment_label_metadata?: Json
          shipping_fee?: number
          shipping_mode?: string
          shipping_notes?: string | null
          shipping_provider?: string
          shipping_status?: string
          status?: string
          stock_deducted_at?: string | null
          subtotal_amount?: number
          tax_amount?: number
          tracking_number?: string | null
          tracking_url?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
          address?: string
          archived_at?: string | null
          cancelled_at?: string | null
          courier_name?: string | null
          created_at?: string
          customer_notes?: string | null
          customer_name?: string
          delivery_date?: string | null
          discount_amount?: number
          dispatch_date?: string | null
          email?: string | null
          estimated_delivery_date?: string | null
          fragile?: boolean
          id?: string
          internal_notes?: string | null
          items?: Json
          operational_status?: string
          order_number?: string | null
          packaging_fee?: number
          payment_method?: string
          payment_expires_at?: string | null
          payment_rejection_reason?: string | null
          payment_screenshot_url?: string | null
          payment_submitted_at?: string | null
          payment_status?: string
          payment_utr?: string | null
          payment_verified_at?: string | null
          phone?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          refund_reason?: string | null
          refund_status?: string | null
          shipment_label_metadata?: Json
          shipping_fee?: number
          shipping_mode?: string
          shipping_notes?: string | null
          shipping_provider?: string
          shipping_status?: string
          status?: string
          stock_deducted_at?: string | null
          subtotal_amount?: number
          tax_amount?: number
          tracking_number?: string | null
          tracking_url?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          color: string
          color_hex: string | null
          created_at: string
          id: string
          price: number | null
          product_id: string
          damaged_stock: number
          reserved_stock: number
          returned_stock: number
          size: string
          sku: string | null
          sold_stock: number
          low_stock_threshold: number
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          color?: string
          color_hex?: string | null
          created_at?: string
          id?: string
          price?: number | null
          product_id: string
          damaged_stock?: number
          reserved_stock?: number
          returned_stock?: number
          size?: string
          sku?: string | null
          sold_stock?: number
          low_stock_threshold?: number
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          color?: string
          color_hex?: string | null
          created_at?: string
          id?: string
          price?: number | null
          product_id?: string
          damaged_stock?: number
          reserved_stock?: number
          returned_stock?: number
          size?: string
          sku?: string | null
          sold_stock?: number
          low_stock_threshold?: number
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
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          id: string
          image_url: string
          in_stock: boolean
          archived_stock: number
          damaged_stock: number
          fragile: boolean
          free_shipping_eligible: boolean
          height_cm: number
          lifetime_sales: number
          length_cm: number
          low_stock_threshold: number
          name: string
          price: number
          product_status: string
          reserved_stock: number
          returned_stock: number
          slug: string
          sold_stock: number
          sort_order: number
          shipping_class: string
          special_packaging: boolean
          stock: number
          tag: string | null
          updated_at: string
          weight_grams: number
          width_cm: number
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          in_stock?: boolean
          archived_stock?: number
          damaged_stock?: number
          fragile?: boolean
          free_shipping_eligible?: boolean
          height_cm?: number
          lifetime_sales?: number
          length_cm?: number
          low_stock_threshold?: number
          name: string
          price?: number
          product_status?: string
          reserved_stock?: number
          returned_stock?: number
          slug: string
          sold_stock?: number
          sort_order?: number
          shipping_class?: string
          special_packaging?: boolean
          stock?: number
          tag?: string | null
          updated_at?: string
          weight_grams?: number
          width_cm?: number
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          in_stock?: boolean
          archived_stock?: number
          damaged_stock?: number
          fragile?: boolean
          free_shipping_eligible?: boolean
          height_cm?: number
          lifetime_sales?: number
          length_cm?: number
          low_stock_threshold?: number
          name?: string
          price?: number
          product_status?: string
          reserved_stock?: number
          returned_stock?: number
          slug?: string
          sold_stock?: number
          sort_order?: number
          shipping_class?: string
          special_packaging?: boolean
          stock?: number
          tag?: string | null
          updated_at?: string
          weight_grams?: number
          width_cm?: number
        }
        Relationships: []
      }
      razorpay_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          order_id: string | null
          payload: Json
          processed_at: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          order_id?: string | null
          payload: Json
          processed_at?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json
          processed_at?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "razorpay_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          approved: boolean
          author_name: string
          body: string
          created_at: string
          id: string
          product_id: string
          rating: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          product_id: string
          rating: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_inventory_stock: {
        Args: {
          p_product_id: string
          p_variant_id?: string | null
          p_quantity?: number
          p_movement_type?: string
          p_note?: string | null
        }
        Returns: Json
      }
      append_order_event: {
        Args: {
          p_order_id: string
          p_event_type: string
          p_label: string
          p_details?: Json
          p_visible_to_customer?: boolean
        }
        Returns: string
      }
      apply_order_stock_locked: { Args: { p_order_id: string }; Returns: Json }
      add_loyalty_points: {
        Args: {
          p_user_id: string
          p_points: number
          p_reason: string
          p_order_id?: string | null
        }
        Returns: Json
      }
      can_review_product: {
        Args: { p_product_id: string; p_user_id?: string | null }
        Returns: boolean
      }
      confirm_manual_order: { Args: { p_order_id: string }; Returns: Json }
      decrement_stock: { Args: { p_items: Json }; Returns: Json }
      ensure_my_role: { Args: never; Returns: undefined }
      ensure_wishlist: { Args: { p_user_id?: string | null }; Returns: string }
      expire_due_upi_orders: { Args: never; Returns: Json }
      expire_upi_order: { Args: { p_order_id: string }; Returns: Json }
      generate_daily_analytics_snapshot: {
        Args: { p_snapshot_date?: string }
        Returns: Json
      }
      get_admin_analytics_summary: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_coupon_analytics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_customer_analytics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_email_analytics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_inventory_analytics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_payment_analytics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_product_analytics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_revenue_series: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_review_analytics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_shipping_analytics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      finalize_razorpay_payment: {
        Args: {
          p_order_id: string
          p_razorpay_order_id: string | null
          p_razorpay_payment_id: string | null
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner_admin: { Args: { _user_id: string }; Returns: boolean }
      log_inventory_event: {
        Args: {
          p_product_id: string
          p_variant_id: string | null
          p_order_id: string | null
          p_movement_type: string
          p_quantity: number
          p_previous_stock: number | null
          p_new_stock: number | null
          p_note?: string | null
        }
        Returns: string
      }
      move_reserved_stock_to_sold: { Args: { p_order_id: string }; Returns: Json }
      reject_manual_payment: {
        Args: { p_order_id: string; p_reason?: string | null }
        Returns: Json
      }
      release_order_stock_locked: { Args: { p_order_id: string }; Returns: Json }
      update_order_operations: {
        Args: {
          p_order_id: string
          p_operational_status?: string | null
          p_shipping_status?: string | null
          p_courier_name?: string | null
          p_tracking_number?: string | null
          p_estimated_delivery_date?: string | null
          p_dispatch_date?: string | null
          p_delivery_date?: string | null
          p_shipping_notes?: string | null
          p_internal_notes?: string | null
          p_refund_status?: string | null
          p_refund_reason?: string | null
          p_event_label?: string | null
          p_visible_to_customer?: boolean
        }
        Returns: Json
      }
      validate_coupon: {
        Args: {
          p_code: string
          p_user_id: string | null
          p_subtotal: number
          p_shipping?: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
