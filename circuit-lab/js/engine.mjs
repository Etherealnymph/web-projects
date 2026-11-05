import createModule from '../vendor/ngspice.mjs';
import { validateFiles, safePath, prepareDeck, parseRaw } from './spice.mjs';

export async function simulate({ files, entry, config }, onLog = () => {}) {
  files = validateFiles(files);
  entry = safePath(entry);
  const main = files.find((file) => file.path === entry);
  if (!main) throw Error('未找到当前网表 ' + entry);
  const deck = prepareDeck(main.content, config);
  const logs = [];
  const log = (line) => {
    if (logs.length < 1500) {
      logs.push(line);
      onLog(line);
    }
  };
  const engine = await createModule({
    noInitialRun: true,
    noExitRuntime: true,
    print: log,
    printErr: log,
  });
  // ngspice's Linux memory probe reads this emulated environment, not host RAM.
  engine.FS.writeFile(
    '/proc/meminfo',
    'MemTotal: 262144 kB\nMemFree: 131072 kB\nMemAvailable: 131072 kB\n',
  );
  engine.FS.mkdir('/project');
  for (const file of files) {
    const directories = file.path.split('/').slice(0, -1);
    let parent = '/project';
    for (const directory of directories) {
      parent += '/' + directory;
      try {
        engine.FS.mkdir(parent);
      } catch (error) {
        if (!engine.FS.analyzePath(parent).exists) throw error;
      }
    }
    engine.FS.writeFile('/project/' + file.path, file.path === entry ? deck : file.content);
  }
  engine.FS.chdir('/project/' + entry.split('/').slice(0, -1).join('/'));
  let code;
  try {
    code = engine.callMain(['-b', '/project/' + entry]);
  } catch (error) {
    if (error.status !== 0) throw Error(error.message + '\n' + logs.slice(-15).join('\n'));
  }
  if (!engine.FS.analyzePath('/result.raw').exists)
    throw Error('ngspice 未输出数据\n' + logs.slice(-20).join('\n'));
  if (code && code !== 0) throw Error('ngspice 返回错误 ' + code + '\n' + logs.slice(-20).join('\n'));
  const stat = engine.FS.stat('/result.raw');
  if (stat.size > 48_000_000) throw Error('结果超过 48 MB，请减少输出点数');
  const result = parseRaw(engine.FS.readFile('/result.raw', { encoding: 'utf8' }));
  return { ...result, logs };
}
