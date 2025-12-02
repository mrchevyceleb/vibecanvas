// Direct schema pull using Supabase Management API
// This bypasses Docker requirement

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://xcjqilfhlwbykckzdzry.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjanFpbGZobHdieWtja3pkenJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjcyNDMyMiwiZXhwIjoyMDc4MzAwMzIyfQ.9oI19WIYfLPaYSS0m2pxSc52FYrxiCvZr8VQnJEdJCw';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function pullSchema() {
  try {
    console.log('📥 Pulling schema from remote database...');
    
    // Query to get all tables
    const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          schemaname,
          tablename,
          tableowner
        FROM pg_tables
        WHERE schemaname IN ('public', 'storage', 'auth')
        ORDER BY schemaname, tablename;
      `
    });

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      // Try alternative approach using direct SQL
      const { data: altTables, error: altError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_schema', 'public');
      
      if (altError) {
        console.error('Alternative query also failed:', altError);
        throw altError;
      }
    }

    // Get schema using pg_dump equivalent queries
    const schemaQueries = [
      `SELECT 
        'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || 
        string_agg(
          column_name || ' ' || data_type || 
          CASE WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')' 
            ELSE '' 
          END ||
          CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
          ', '
        ) || ');' as ddl
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY schemaname, tablename;`
    ];

    // For now, let's use a simpler approach - query information_schema
    const { data: columns, error: colsError } = await supabase
      .from('information_schema.columns')
      .select('*')
      .eq('table_schema', 'public');

    if (colsError) {
      console.error('Error:', colsError);
      throw colsError;
    }

    // Generate migration file
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '');
    const migrationFile = join(process.cwd(), 'supabase', 'migrations', `${timestamp}_remote_schema.sql`);
    
    let sql = `-- Migration: Remote schema snapshot
-- Generated: ${new Date().toISOString()}
-- Source: Remote Supabase database (xcjqilfhlwbykckzdzry)

`;

    // Group columns by table
    const tablesMap = new Map();
    columns.forEach(col => {
      if (!tablesMap.has(col.table_name)) {
        tablesMap.set(col.table_name, []);
      }
      tablesMap.get(col.table_name).push(col);
    });

    // Generate CREATE TABLE statements
    tablesMap.forEach((cols, tableName) => {
      sql += `\n-- Table: ${tableName}\n`;
      sql += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
      
      const colDefs = cols.map(col => {
        let def = `  ${col.column_name} ${col.data_type}`;
        if (col.character_maximum_length) {
          def += `(${col.character_maximum_length})`;
        }
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        return def;
      });
      
      sql += colDefs.join(',\n');
      sql += '\n);\n';
    });

    writeFileSync(migrationFile, sql);
    console.log(`✅ Schema pulled successfully!`);
    console.log(`📝 Migration file: ${migrationFile}`);
    console.log(`📊 Found ${tablesMap.size} tables`);

  } catch (error) {
    console.error('❌ Error pulling schema:', error);
    process.exit(1);
  }
}

pullSchema();


