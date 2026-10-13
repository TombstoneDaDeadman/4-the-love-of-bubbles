import {readFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const required = ['Assets/_Project/Scenes/SCN_HomeWorkshop.unity','Assets/_Project/Scenes/SCN_Bootstrap.unity','Assets/_Project/Data/SO_GameCatalog.asset','Assets/_Project/Settings/URP_Pipeline.asset','Assets/_Project/ThirdParty/Kenney/License.txt','docs/Game-Development-Brief.pdf'];
for (const path of required) assert(existsSync(path), `Missing required project artifact: ${path}`);
const deps = JSON.parse(readFileSync('Packages/manifest.json')).dependencies;
assert.equal(deps['com.unity.render-pipelines.universal'], '17.5.0');
assert.equal(deps['com.unity.inputsystem'], '1.19.0');
assert(Object.values(deps).every(v => !v.startsWith('file:')), 'Machine-local package paths are not portable');
const guids = new Map();
function walk(path) {
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    if (name.endsWith('.meta')) {
      const match = readFileSync(child, 'utf8').match(/^guid: ([0-9a-f]{32})$/m);
      assert(match, `Missing GUID in ${child}`);
      assert(!guids.has(match[1]), `Duplicate GUID: ${child} and ${guids.get(match[1])}`);
      guids.set(match[1],child);
    } else {
      assert(existsSync(child+'.meta'), `Missing meta file: ${child}`);
      if (statSync(child).isDirectory()) walk(child);
    }
  }
}
walk('Assets');
const files = execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n');
assert(!files.some(p=>/^(Library|Temp|Logs|UserSettings|Builds|Verification)\//i.test(p)), 'Generated files were tracked');
console.log(`Project structure and ${guids.size} unique Unity GUIDs validated.`);
