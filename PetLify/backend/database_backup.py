"""Native PostgreSQL backup and restore to an empty database.

DATABASE_BACKUP_URL must point to a direct connection. Credentials stay in the
child process environment, never in command-line arguments or printed output.
"""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

from dotenv import load_dotenv
import psycopg
from psycopg.conninfo import conninfo_to_dict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


def native_url(url):
    try:
        parsed = make_url(url)
    except ArgumentError:
        raise ValueError('URL PostgreSQL inválida.') from None
    if parsed.get_backend_name() not in ('postgres', 'postgresql'):
        raise ValueError('Backup exige uma URL PostgreSQL.')
    return parsed.set(drivername='postgresql').render_as_string(hide_password=False)


def connection_environment(url):
    parameters = conninfo_to_dict(native_url(url))
    names = {item.keyword.decode(): item.envvar.decode()
             for item in psycopg.pq.Conninfo.get_defaults() if item.envvar}
    environment = os.environ.copy()
    for name in names.values():
        environment.pop(name, None)
    for key, value in parameters.items():
        if key not in names:
            raise ValueError('Opção de conexão sem variável de ambiente compatível.')
        environment[names[key]] = value
    environment.setdefault('PGCONNECT_TIMEOUT', '15')
    return environment


def run_tool(bin_dir, name, arguments, url):
    executable = (Path(bin_dir) / (name + ('.exe' if os.name == 'nt' else ''))) if bin_dir else shutil.which(name)
    if not executable or not Path(executable).is_file():
        raise ValueError(f'{name} não encontrado. Informe --pg-bin com a pasta bin do PostgreSQL.')
    result = subprocess.run([str(executable), *arguments], env=connection_environment(url),
                            capture_output=True,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    if result.returncode:
        raise RuntimeError(f'{name} falhou. Confira versão, conexão e permissões; detalhes privados não foram exibidos.')


def backup(url, output, bin_dir=None):
    output = Path(output)
    if output.exists():
        raise ValueError('O arquivo de destino já existe. Escolha um novo nome.')
    output.parent.mkdir(parents=True, exist_ok=True)
    # Publish the archive only after pg_dump succeeds; exclusive creation avoids overwrites.
    with tempfile.TemporaryDirectory(prefix='petlify-backup-') as directory:
        temporary = Path(directory) / 'database.dump'
        run_tool(bin_dir, 'pg_dump', ['--format=custom', '--no-owner', '--no-acl',
                                    '--file', str(temporary)], url)
        with output.open('xb') as destination, temporary.open('rb') as source:
            shutil.copyfileobj(source, destination)


def restore(url, source, bin_dir=None):
    source = Path(source)
    if not source.is_file():
        raise ValueError('Arquivo de backup não encontrado.')
    with psycopg.connect(native_url(url), connect_timeout=15) as connection:
        count = connection.execute("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                                   "WHERE n.nspname NOT IN ('pg_catalog','information_schema') "
                                   "AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','f','S')").fetchone()[0]
        if count:
            raise ValueError('Restauração recusada: use um banco de destino vazio e separado.')
    # No --clean: never erase destination tables. Failure rolls back the entire restore.
    run_tool(bin_dir, 'pg_restore', ['--single-transaction', '--exit-on-error', '--no-owner', '--no-acl',
                                   '--dbname', conninfo_without_password(url), str(source)], url)


def conninfo_without_password(url):
    # pg_restore requires --dbname. The environment supplies all connection details.
    # A plain database name must not be interpreted as URI or conninfo.
    from psycopg.conninfo import make_conninfo
    return make_conninfo(dbname=conninfo_to_dict(native_url(url))['dbname'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['backup', 'restore'])
    parser.add_argument('file', type=Path)
    parser.add_argument('--pg-bin', help='Directory containing pg_dump/pg_restore.')
    args = parser.parse_args()
    load_dotenv(Path(__file__).resolve().parent / '.env')
    url = os.environ.get('DATABASE_BACKUP_URL')
    if not url:
        parser.exit(1, 'Configure DATABASE_BACKUP_URL com a conexão direta do banco correspondente.\n')
    try:
        (backup if args.operation == 'backup' else restore)(url, args.file, args.pg_bin)
    except (ValueError, RuntimeError, psycopg.Error, OSError):
        # Invalid URLs and DBAPI errors can contain credentials; don't print them.
        parser.exit(1, 'Operação não concluída. Confira URL direta, arquivo, versão das ferramentas e destino vazio.\n')
    print(f'{args.operation} concluído: {args.file}')


if __name__ == '__main__':
    main()
