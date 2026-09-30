"""Local QA preview backed by a disposable SQLite database, never the dev DB."""
import argparse
import os
from pathlib import Path
import tempfile


def main():
    parser = argparse.ArgumentParser(description='Preview local com banco temporário de demonstração.')
    parser.add_argument('--port', type=int, default=5056)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='petlify-jornada-') as directory:
        os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(directory) / 'preview.db').as_posix()
        os.environ['BCRYPT_LOG_ROUNDS'] = '4'
        os.environ['FLASK_ENV'] = 'development'
        # Set the disposable URI before importing Config/app.
        from app import create_app
        from extensions import db
        from flask_migrate import upgrade
        from seed_dev import seed
        app = create_app()
        with app.app_context():
            assert Path(db.engine.url.database).resolve().parent == Path(directory).resolve()
            upgrade(directory=str(Path(__file__).resolve().parent / 'migrations'))
            seed()
        print(f'Preview de QA: http://127.0.0.1:{args.port}; banco temporário independente.', flush=True)
        try:
            app.run(host='127.0.0.1', port=args.port, debug=False, use_reloader=False)
        except KeyboardInterrupt:
            pass
        finally:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()


if __name__ == '__main__':
    main()
