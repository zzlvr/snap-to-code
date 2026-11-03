import { Studio } from "@/components/studio/studio";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Snap to Code</h1>
            <p className="max-w-2xl text-muted-foreground">
              Вставьте скриншот интерфейса — получите чистый React-код на Tailwind и shadcn/ui, разбитый на компоненты.
              Работает целиком в браузере: ваш ключ и картинки не попадают на наш сервер.
            </p>
          </div>
        </div>
      </header>
      <Studio />
    </main>
  );
}
