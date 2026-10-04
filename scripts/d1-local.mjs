import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(filename=':memory:'){
 const db=new DatabaseSync(filename);
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rooms'").get())db.exec(readFileSync(new URL('../drizzle/0000_party.sql',import.meta.url),'utf8'));
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='generated_fingerprints'").get())db.exec(readFileSync(new URL('../drizzle/0001_generated_fingerprints.sql',import.meta.url),'utf8'));
 return {raw:db,prepare(sql){const statement=db.prepare(sql);let values=[];const api={bind(...v){values=v;return api;},async first(){return statement.get(...values)||null;},runSync(){const r=statement.run(...values);return {meta:{changes:Number(r.changes)}};},async run(){return api.runSync();},async all(){return {results:statement.all(...values)};}};return api;},async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>s.runSync());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
