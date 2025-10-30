# Соответствие оригинальной документации

Плагин теперь полностью соответствует оригинальной документации [docs.sheetssync.app](https://docs.sheetssync.app/how-a-value-is-applied-to-a-layer).

## Изменения для соответствия

### 1. ✅ Text Layers (Текстовые слои)
**Документация:** "The value will be used to set the content within the text layer."

**Реализация:**
- Значение напрямую применяется как текст
- Поддерживаются специальные префиксы `/` для цветов и видимости

### 2. ✅ Images (Изображения)
**Документация:** "If the value is a URL starting with `http://` or `https://` the Plugin will fetch the data from that URL"

**Реализация:**
- ✅ Проверка что URL начинается с `http://` или `https://`
- ✅ Автоматическое определение изображений по расширению (.png, .jpg, .gif, .webp, .svg)
- ✅ Поддержка Google Drive изображений (googleusercontent.com, drive.google.com)
- ✅ Применяется только к векторным слоям (не к текстовым, фреймам или компонентам)

**Дополнительно:**
- CORS proxy для загрузки изображений с ограничениями
- Определение по имени слоя: `thumbnail`, `image`, `photo`, `avatar`, `icon`

### 3. ✅ Components (Компоненты)
**Документация:** "The value in the Sheets file is the name of the Main Component you want to swap it with"

**Реализация:**
- ✅ Значение = имя главного компонента
- ✅ Не чувствительно к регистру
- ✅ Точное совпадение пунктуации и пробелов
- ✅ Поиск в текущей странице/выборке

### 4. ✅ Component Variants (Варианты компонентов)
**Документация:** "The name of a variant will be structured like: `Property 1=Value, Property 2=Value, Property 3=Value`"

**Реализация:**
- ✅ Формат: `Property=Value, Property=Value` (запятые с пробелами)
- ✅ Должны быть указаны ВСЕ свойства
- ✅ Порядок свойств должен соответствовать определению в Figma
- ❌ Убрана поддержка `|` как разделителя (было в старой версии)

## Примеры использования

### Текст
```
Excel: "Hello World"
Figma: #Text → "Hello World"
```

### Изображения
```
Excel: "https://example.com/image.jpg"
Figma: #Image (Rectangle/Vector) → загружается и применяется как фон
```

### Google Drive изображения
```
Excel: "https://lh3.googleusercontent.com/drive-storage/..."
Figma: #Thumbnail → автоматически определяется как изображение
```

### Компоненты
```
Excel: "Primary Button"
Figma: #Button (Instance) → заменяется на компонент "Primary Button"
```

### Варианты
```
Excel: "Type=Primary, Size=Large, State=Default, Icon=True"
Figma: #Button (Instance) → устанавливаются все указанные свойства
```

## Отличия от оригинала

### Что убрано:
- ❌ Google OAuth авторизация
- ❌ Google Sheets API
- ❌ Синхронизация из облака

### Что добавлено:
- ✅ Загрузка локальных Excel (.xlsx) файлов
- ✅ CORS proxy для изображений
- ✅ Drag & drop интерфейс
- ✅ Простой single-screen UI

### Что осталось без изменений:
- ✅ Система именования слоев с `#`
- ✅ Все типы данных (text, images, colors, variants, links)
- ✅ Специальные префиксы (`/show`, `/hide`, `/#color`)
- ✅ Логика определения типов полей
- ✅ Клонирование шаблонов и заполнение данными

## Проверочный список

- [x] URL для изображений начинаются с `http://` или `https://`
- [x] Варианты используют запятые как разделитель
- [x] Поддержка Google Drive изображений
- [x] Компоненты заменяются по имени
- [x] Текст применяется напрямую
- [x] Цвета в формате hex (#RRGGBB)
- [x] Видимость через `/show` и `/hide`
- [x] Гиперссылки для URL в текстовых слоях


