# Office Service Desk

**Sistema de incidencias TI para oficinas**

Este es un proyecto académico que hice para practicar cómo se construye una aplicación web con frontend, backend y base de datos.

La idea es sencilla: que una oficina pueda registrar sus problemas de TI, asignarlos a una persona encargada y consultar qué se hizo para atenderlos. También permite revisar el historial de cada incidencia y algunos indicadores.

El proyecto funciona de forma local. Lo estoy preparando como parte de mi portafolio para mostrar lo que he aprendido; **no está desplegado en internet ni ha sido probado como un sistema de producción**.

## ¿Qué se puede hacer?

- Iniciar sesión y administrar usuarios con diferentes permisos.
- Registrar incidencias y consultar su estado.
- Clasificarlas por categoría, impacto, urgencia y prioridad.
- Asignarlas a personal técnico.
- Registrar intentos de solución, devoluciones y cierres.
- Consultar el historial de acciones de una incidencia.
- Adjuntar archivos de forma privada.
- Crear borradores y publicar artículos en una base de conocimiento.
- Ver indicadores y notificaciones dentro del sistema.
- Utilizar asistencia con Gemini de forma opcional. Por defecto está desactivada.

## Herramientas que usé

| Parte del sistema | Tecnologías |
| --- | --- |
| Backend (lo que procesa las solicitudes) | Python, FastAPI, SQLAlchemy, Pydantic, PyMySQL |
| Base de datos | MySQL y Alembic |
| Frontend (las pantallas) | React, TypeScript y Vite |
| Inicio de sesión | Tokens JWT |

En pocas palabras, **React** muestra las pantallas; **FastAPI** recibe las solicitudes y aplica las reglas del sistema; **MySQL** guarda la información. **Alembic** sirve para crear y actualizar las tablas en el orden correcto.

## Carpetas principales

```text
office-service-desk/
├── backend/
│   ├── app/
│   │   ├── commands/       # Comandos auxiliares
│   │   ├── core/           # Configuración principal
│   │   ├── modules/        # Funciones del sistema
│   │   └── main.py
│   ├── migrations/         # Cambios de la base de datos
│   ├── .env.example        # Plantilla de configuración
│   └── requirements.txt    # Librerías de Python
├── frontend/
│   ├── src/                # Código de React
│   ├── public/             # Recursos públicos
│   ├── package.json
│   └── package-lock.json
├── docs/                   # Documentación y capturas (pendiente)
├── .gitignore
└── README.md
```

Los archivos privados de configuración, las dependencias instaladas y los adjuntos que se generan al usar el programa no deben subirse al repositorio.

## Cómo ejecutarlo en Windows

Estas instrucciones están pensadas para **PowerShell**. En mi equipo lo probé con **Python 3.14.7**, **Node.js 24.20.0** y **npm 11.19.0**. Son las versiones que utilicé, no una lista de versiones mínimas comprobadas.

También necesitas MySQL en funcionamiento y una herramienta para administrarlo, como MySQL Workbench.

### 1. Descargar el proyecto

Descarga o clona el repositorio y abre la carpeta `office-service-desk` en VS Code.

### 2. Crear la base de datos

Desde una conexión de administración de MySQL, ejecuta:

```sql
CREATE DATABASE office_service_desk
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

Crea dos usuarios de MySQL con contraseñas propias: uno para la aplicación y otro para actualizar la estructura de las tablas. Puedes hacerlo desde MySQL Workbench. Sus permisos deben limitarse a `office_service_desk`:

| Usuario sugerido | Permisos |
| --- | --- |
| `office_app` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` |
| `office_migrator` | Los anteriores más `CREATE`, `ALTER`, `DROP`, `INDEX` y `REFERENCES` |

No utilices las credenciales de otra base de datos. Si cambias los nombres de usuario, tendrás que colocar los tuyos en el archivo `.env`.

### 3. Preparar el backend

**Ubicación de la terminal:** `office-service-desk/backend`

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item ".env.example" ".env"
```

Abre `backend/.env` y completa la conexión con tus datos de MySQL. Una configuración local se ve así (las contraseñas son ejemplos que debes reemplazar):

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=office_service_desk
DB_USER=office_app
DB_PASSWORD=TU_CONTRASENA_PRIVADA
MIGRATION_DB_USER=office_migrator
MIGRATION_DB_PASSWORD=TU_OTRA_CONTRASENA_PRIVADA
JWT_SECRET_KEY=TU_CLAVE_ALEATORIA
ACCESS_TOKEN_EXPIRE_MINUTES=30
AI_ENABLED=false
```

Para generar una clave JWT, ejecuta **desde `backend`**:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(64))"
```

Copia el resultado en `JWT_SECRET_KEY`. **No compartas esa clave ni subas el archivo `.env` a GitHub.**

### 4. Crear las tablas y el primer administrador

**Ubicación de la terminal:** `office-service-desk/backend`

Primero verifica que `DB_NAME` corresponda a la base nueva que acabas de crear. Luego ejecuta:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
```

Después crea la primera cuenta administrativa:

```powershell
.\.venv\Scripts\python.exe -m app.commands.bootstrap_admin
```

El programa te pedirá nombre, correo y contraseña. No hay una contraseña predeterminada publicada en el proyecto.

### 5. Iniciar el backend

**Ubicación de la terminal:** `office-service-desk/backend`

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Puedes revisar las rutas de la API en <http://127.0.0.1:8001/docs>.

### 6. Iniciar el frontend

Abre **otra terminal**, sin cerrar la del backend.

**Ubicación de la terminal:** `office-service-desk/frontend`

```powershell
npm ci
npm run dev
```

Abre <http://localhost:5174/> e inicia sesión con la cuenta que creaste. En este entorno local, Vite envía las solicitudes `/api` al backend que está en el puerto `8001`.

Los puertos `8001` y `5174` son los que utilicé para esta copia del proyecto. Si los cambias, revisa también la configuración de `frontend/vite.config.ts`.

## Archivos adjuntos e IA

Los archivos adjuntos se guardan, por defecto, en `backend/storage/attachments`. Esa carpeta se excluye de Git para no publicar archivos privados.

La ayuda con Gemini es opcional y **no hace falta para iniciar el sistema**. En la configuración de ejemplo está desactivada (`AI_ENABLED=false`). Si se habilita después, la clave de Gemini debe permanecer en el backend, nunca en el frontend.

## ¿Qué he comprobado hasta ahora?

Durante la preparación de esta versión hice estas pruebas:

- Creé una base MySQL nueva y apliqué las **15 migraciones** de Alembic.
- Creé el primer administrador desde el comando del backend.
- Comprobé que el backend iniciara y mostrara la documentación de FastAPI.
- Comprobé la creación y lectura básica de un token JWT.
- Compilé el frontend con `npm run build` sin errores.
- Inicié sesión desde React y abrí las secciones de usuarios, incidencias y notificaciones.

**Todavía me falta comprobar** una instalación completa desde una carpeta limpia, el recorrido de una incidencia de principio a fin, todos los permisos por rol, la carga y descarga de adjuntos y los flujos con la IA desactivada.

Que el programa compile o abra una pantalla no significa que todas sus funciones estén probadas.

## Capturas

Estoy preparando capturas con la identidad genérica de Office Service Desk y datos de ejemplo. Las agregaré cuando termine de revisar que no muestren contraseñas ni información privada.

## Sobre este proyecto

Es un proyecto que realicé mientras aprendía sobre desarrollo web y bases de datos. **Me apoyé bastante en herramientas de inteligencia artificial**, tanto para escribir y revisar código como para entender errores y encontrar soluciones.

Mi trabajo también incluyó integrar las partes del sistema, configurar el entorno y realizar las pruebas que describo arriba. Todavía hay aspectos del código que sigo estudiando. Comparto este repositorio como muestra de mi aprendizaje, no como un producto listo para una empresa.

**Perfil de GitHub:** [`@gdlunao`](https://github.com/gdlunao).

## Glosario rápido

| Término | Qué significa aquí |
| --- | --- |
| **Frontend** | La parte visual: pantallas, botones y formularios. |
| **Backend** | La parte que recibe solicitudes y procesa la información. |
| **API** | La forma en que el frontend se comunica con el backend. |
| **Base de datos** | Lugar donde se guardan usuarios, incidencias e historiales. |
| **JWT** | Token usado para identificar a un usuario que inició sesión. |
| **Rol** | Tipo de usuario que determina a qué funciones puede acceder. |
| **Migración** | Cambio guardado que crea o modifica tablas en MySQL. |
| **Entorno virtual (`.venv`)** | Carpeta que mantiene separadas las librerías de Python del proyecto. |
| **`.env`** | Archivo local donde se colocan configuraciones y claves privadas. |
| **`README.md`** | Documento principal que explica el proyecto y cómo ejecutarlo. |
| **Repositorio** | Carpeta de código y archivos que se administra con Git. |
| **Commit** | Registro de un conjunto de cambios en Git. |

## Licencia y recursos gráficos

Por ahora no he elegido una licencia de código abierto. Antes de publicar el repositorio revisaré los permisos del código y los recursos utilizados.

La ilustración del inicio de sesión fue generada con IA. La herramienta utilizada y sus condiciones de uso quedan pendientes de confirmar.
