export function helpText(): string[] {
  return [
    '',
    'Usage: tower <command>',
    '',
    'Commands:',
    '  create           Scaffold a new Tower application',
    '  create --name my-app --modules vault,gatehouse  Scaffold non-interactively',
    '  create --js my-app          Scaffold a plain JavaScript app (default is TypeScript)',
    '  about            Show application, module, runtime, and environment diagnostics',
    '  migrate          Run database and auth migrations',
    '  migrate --seed   Run migrations, then seeds',
    '  seed             Run seeds (runs migrations first unless --skip-migrate)',
    '  seed --skip-migrate  Run seeds without running migrations first',
    '  make model|migration|policy|factory|job <Name>  Generate starter files',
    '  help             Show this message',
    '  --version, -v    Show version',
    '',
  ]
}
