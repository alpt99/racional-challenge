## Racional Challenge API

Api con Prisma y PostgreSQL.

### Prerequisitos

- Node 24.0.2 (or any version supported by Prisma 7+)
- Local PostgreSQL: se puso un ejemplo de la unica variable de entorno del .env para conectarse a la db que se tiene que crear

### Env

1. Duplicar .env.example con la base de datos que crees

2. Asegurarse que ldb (`racional_challenge` en mi caso) exista en Postgres.

### Install & database

```bash
npm install
npm run prisma:migrate      # runs `prisma migrate dev`
npm run prisma:generate     # optional: regenerate Prisma client
npm run prisma:seed         # seeds demo user + empty portfolio
```

### Development

```bash
npm run dev
```

La api corre en [http://localhost:3000](http://localhost:3000).
Una vez este arriba la api se puede jugar con los distintos endpoints. Adjunto un postman en el repo para probar los distintos endpoints. Ya existe un usuario creado con un portafolio vacio y una stock para comprar.

# Descripción de mi modelo de datos

En mi modelo de datos parti diseñando las entidades de las cuales llegue al siguiente modelo.

model User {
id Int @id @default(autoincrement())
email String @unique
name String?
phone String?
birthDate DateTime?
portfolios Portfolio[]
}

model Portfolio {
id String @id @default(uuid())
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
userId Int
name String
baseCurrency String @db.Char(3)
totalValue Decimal @default(0)
cashValue Decimal @default(0)
investedValue Decimal @default(0)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

positions PortfolioPosition[]
cashMovements CashMovement[]
orders Order[]
snapshots PortfolioSnapshot[]
}

model Stock {
id String @id @default(uuid())
symbol String @unique
name String
exchange String
currency String @db.Char(3)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

positions PortfolioPosition[]
orders Order[]
}

model PortfolioPosition {
id String @id @default(uuid())
portfolio Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
portfolioId String
stock Stock @relation(fields: [stockId], references: [id])
stockId String
currency String
quantity Decimal @default(0)
avgPrice Decimal @default(0)
lastPrice Decimal?
updatedAt DateTime @default(now()) @updatedAt

@@unique([portfolioId, stockId])
}

enum CashMovementType {
DEPOSIT
WITHDRAWAL
ORDER_SETTLEMENT
ADJUSTMENT
}

model CashMovement {
id String @id @default(uuid())
portfolio Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
portfolioId String
type CashMovementType
amount Decimal
currency String @db.Char(3)
happenedAt DateTime
note String?
createdAt DateTime @default(now())
}

enum OrderSide {
BUY
SELL
}

enum OrderStatus {
PENDING
FILLED
CANCELED
}

model Order {
id String @id @default(uuid())
portfolio Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
portfolioId String
stock Stock @relation(fields: [stockId], references: [id])
stockId String
side OrderSide
quantity Decimal
price Decimal
currency String
status OrderStatus @default(PENDING)
placedAt DateTime
filledAt DateTime?
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
}

model PortfolioSnapshot {
id String @id @default(uuid())
portfolio Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
portfolioId String
asOf DateTime
totalValue Decimal
cashValue Decimal
investedValue Decimal
createdAt DateTime @default(now())

@@unique([portfolioId, asOf])
}

La razón de este modelo es la siguiente, en la app actual de racional se puede apreciar que un usuario puede tener distintos portafolios destinados a distintas cosas. Unos pueden ser más riesgosos que otros porque pueden tener objetivos distintos, por lo que la relacion de usuario portafolio es 1 a N.

Por otro lado, portafolio se usa como un resumen del portafolio para tener velocidad y facilidad al momento de acceder datos (No tener que hacer el calculo constantemente de cuanto es el valor del portafolio actualmente). PortfolioPositions se usa para la relacion entre portafolio y stocks, donde ahi se pueden ver todas las acciones que uno puede tener. Tener en cuenta que al comprar una acción que ya existe en el portafolio no se crea una nueva fila sino que se actualiza la posicion existente y sus montos. De esta forma se puede validar no vender más de lo que tienes por ejemplo.

Se uso una tabla especifica para guardar el snapshot debido a que al ser tantos datos la idea es optimizar esta consulta sin tener que hacer joins y solo consultar esa tabla especifica.

Otras consideraciones:

- Por simplicidad se asume que al poner una orden se concreta automaticamente. Ej. si es BUY, se compra altiro la accion
- Al modificar user no se puede modificar el email
- Al modificar portfolio solo se puede modificar name, pero queda facil de expandir a que pueda agregarse riesgo y más informacion del portafolio en especifico, por ejemplo, una posible extension de conectar una cuenta de un banco al portafolio

# Cosas para hacer en un futuro / Pendiente

- Tests, si bien alcanze a instalar jest, no alcance a crear los tests en sí por u tema de tiempo, sería lo primero en la tarea para validar posibles errores en casos bordes.
- Ordenar más el codigo, debido a que creo que le falta mucho orden

# Uso de IA

Utilice cursor para las siguientes tareas:

- Validar decisión de utilizacipon de prisma
- Autocompletar codigo (forma general)
- Validar diseño inicial para ver si cubria casos de uso y casos bordes, por ejemplo, me recomendó variaciones en campos necesarios en algunas entidades por ejemplo para Order, usar el tipo que sea BUY y SELL para que en un futuro se pueda concretar la orden con el filledAt. Esto era un caso que no tenia tan cubierto.

# Consideración Técnica

Por temas de velocidad utilice Prisma que solo lo habia usado un par de veces, pero veia que me podía entregar la velocidad dado que estaba con poco tiempo. Generalmente trabajo sin un ORM en mi trabajo actual, que me parece te da la libertad de poder ordenar más el codigo, pero pierdes mucha velocidad segun mi perspectica. Espero no sea problema utilizar Prisma para la tarea, a pesar de que no vi textualmente esto en el enunciado.
