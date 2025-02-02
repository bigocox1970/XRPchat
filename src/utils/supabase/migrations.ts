import { supabaseAdmin } from './client.js';

export const runLastActiveMigration = async () => {
  try {
    // Add last_active column
    const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        alter table public.profiles
        add column if not exists last_active timestamp with time zone default timezone('utc'::text, now());
      `
    });

    if (alterError) throw alterError;

    // Update existing profiles
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ last_active: new Date().toISOString() })
      .is('last_active', null);

    if (updateError) throw updateError;

    // Create function and trigger
    const { error: triggerError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        create or replace function update_last_active()
        returns trigger as $$
        begin
          update public.profiles
          set last_active = now()
          where id = new.sender_id;
          return new;
        end;
        $$ language plpgsql security definer;

        drop trigger if exists update_last_active_on_message on public.messages;
        create trigger update_last_active_on_message
          after insert on public.messages
          for each row
          execute function update_last_active();
      `
    });

    if (triggerError) throw triggerError;

    return { success: true };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error };
  }
};
