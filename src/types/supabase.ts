export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          avatar_seed: string | null;
          wallet_address: string;
          updated_at: string;
          last_active: string | null;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          avatar_seed?: string | null;
          wallet_address: string;
          updated_at?: string;
          last_active?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
          avatar_seed?: string | null;
          wallet_address?: string;
          updated_at?: string;
          last_active?: string | null;
        };
      };
      wallets: {
        Row: {
          id: string;
          profile_id: string;
          address: string;
          public_key: string;
          private_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          address: string;
          public_key: string;
          private_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          address?: string;
          public_key?: string;
          private_key?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      threads: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          participant_ids: string[];
          last_message_at: string | null;
          created_by: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          participant_ids: string[];
          last_message_at?: string | null;
          created_by: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name?: string;
          participant_ids?: string[];
          last_message_at?: string | null;
          created_by?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          created_at: string;
          thread_id: string;
          sender_id: string;
          content: string;
          read: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          thread_id: string;
          sender_id: string;
          content: string;
          read?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          thread_id?: string;
          sender_id?: string;
          content?: string;
          read?: boolean;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      send_message: {
        Args: {
          p_thread_id: string;
          p_sender_id: string;
          p_content: string;
        };
        Returns: {
          id: string;
          created_at: string;
          thread_id: string;
          sender_id: string;
          content: string;
          read: boolean;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
