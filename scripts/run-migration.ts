import { runLastActiveMigration } from '../src/utils/supabase/migrations';

const main = async () => {
  console.log('Running last_active migration...');
  
  try {
    const result = await runLastActiveMigration();
    if (result.success) {
      console.log('Migration completed successfully');
    } else {
      console.error('Migration failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

main();
