import React, { useState } from 'react';
import { Modal } from './Modal';
import { Table } from 'lucide-react';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Language = 'ru' | 'uk';

const LanguageToggle: React.FC<{ lang: Language, setLang: (lang: Language) => void }> = ({ lang, setLang }) => (
    <div className="flex justify-center mb-6 p-1 bg-slate-200 dark:bg-slate-900 rounded-lg">
      <button
          onClick={() => setLang('ru')}
          className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
              lang === 'ru' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
      >
        Русский
      </button>
      <button
          onClick={() => setLang('uk')}
          className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
              lang === 'uk' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
          }`}
      >
        Українська
      </button>
    </div>
);

const ExcelSchema = ({ lang1, lang2, example1, example2 }: { lang1: string, lang2: string, example1: string, example2: string }) => (
    <div className="my-4 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden text-xs sm:text-sm shadow-sm">
      {/* Header Row (Columns) */}
      <div className="grid grid-cols-4 bg-slate-100 dark:bg-slate-700 font-bold text-center border-b border-slate-200 dark:border-slate-600">
          <div className="p-2 border-r border-slate-200 dark:border-slate-600">A</div>
          <div className="p-2 border-r border-slate-200 dark:border-slate-600 text-slate-400">B</div>
          <div className="p-2 border-r border-slate-200 dark:border-slate-600">C</div>
          <div className="p-2 text-slate-400">D</div>
      </div>
      {/* Header Row (Data) */}
      <div className="grid grid-cols-4 bg-indigo-50/50 dark:bg-indigo-900/20 text-center border-b border-slate-200 dark:border-slate-600">
          <div className="p-2 border-r border-slate-200 dark:border-slate-600 font-semibold text-indigo-700 dark:text-indigo-300">{lang1}</div>
          <div className="p-2 border-r border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"></div>
          <div className="p-2 border-r border-slate-200 dark:border-slate-600 font-semibold text-indigo-700 dark:text-indigo-300">{lang2}</div>
          <div className="p-2 bg-slate-50 dark:bg-slate-800/50"></div>
      </div>
      {/* Example Data Row */}
      <div className="grid grid-cols-4 bg-white dark:bg-slate-800 text-center">
          <div className="p-2 border-r border-slate-200 dark:border-slate-600">{example1}</div>
          <div className="p-2 border-r border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50"></div>
          <div className="p-2 border-r border-slate-200 dark:border-slate-600">{example2}</div>
          <div className="p-2 bg-slate-50 dark:bg-slate-900/50"></div>
      </div>
    </div>
  );

const RussianContent: React.FC = () => (
    <>
      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">1. Начало работы</h2>
        <p>
            На главном экране вы можете войти в свой аккаунт Google, а затем нажать кнопку <strong>"Select Dictionary"</strong>.
        </p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Вход в аккаунт:</strong> Это позволит синхронизировать ваши словари и прогресс между устройствами.</li>
          <li><strong>Автозагрузка:</strong> Приложение автоматически запоминает и загружает последний использованный вами словарь.</li>
          <li><strong>Выбор словаря:</strong> Можно выбрать встроенный словарь, ранее загруженный (My Dictionaries) или загрузить новый файл Excel.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">2. Подготовка файлов</h2>
        <p className="mb-3">
          Для создания собственного словаря используйте Excel (.xlsx). Структура файла должна быть следующей:
        </p>
        
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">
            <Table size={16} /> Схема Excel файла:
        </div>
        
        <ExcelSchema lang1="English" lang2="Russian" example1="Apple" example2="Яблоко" />

        <ul className="list-disc list-inside space-y-2 mt-3 text-sm">
            <li><strong>Строка 1 (Заголовок):</strong> Названия языков (например, English, Russian).</li>
            <li><strong>Столбец A:</strong> Слова на изучаемом языке.</li>
            <li><strong>Столбец C:</strong> Перевод.</li>
            <li><strong>Столбцы B и D:</strong> Должны оставаться пустыми (для разделения).</li>
        </ul>
        <p className="mt-3 text-sm text-slate-500 border-l-2 border-indigo-400 pl-3">
            Вы можете размещать несколько наборов на одном листе, продолжая структуру (следующая пара в столбцах E и G, и т.д.).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">3. Процесс тренировки и Управление</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Свайпы (Жесты):</strong> На сенсорных экранах смахните карточку <strong>влево</strong> ("Don't know") или <strong>вправо</strong> ("Know").</li>
          <li><strong>Горячие клавиши:</strong>
             <ul className="list-disc list-inside pl-5 mt-1 text-sm">
                 <li><strong>Пробел:</strong> Перевернуть карточку.</li>
                 <li><strong>1 или Стрелка влево:</strong> Не знаю (Don't know).</li>
                 <li><strong>2 или Стрелка вправо:</strong> Знаю (Know).</li>
             </ul>
          </li>
          <li><strong>Zen Mode:</strong> Нажмите иконку расширения (стрелки) над карточкой, чтобы скрыть меню и списки, оставив только карточку для фокусировки.</li>
          <li><strong>Magic Example (ИИ):</strong> Нажмите кнопку с "волшебной палочкой" ✨ в углу карточки. ИИ создаст "Умную карточку" с определением слова, примером использования и полезным словосочетанием.</li>
          <li><strong>Настройки звука:</strong> Нажмите на шестеренку на обратной стороне карточки, чтобы выбрать <strong>голос</strong> (например, Google US English) и <strong>скорость речи</strong>.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">4. Тренировка незнакомых слов</h2>
        <p>
          Слова, помеченные как <strong>"Don't know"</strong>, можно тренировать отдельно.
        </p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Write (Письменно):</strong> Введите перевод вручную. <strong>Умный ИИ</strong> проверит ваш ответ: он засчитает правильные синонимы и простит мелкие опечатки.</li>
          <li><strong>Guess (Тест):</strong> Выберите правильный вариант из предложенных.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">5. Геймификация и Прогресс</h2>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Daily Streak (Огонек):</strong> Иконка огня в шапке показывает серию дней непрерывного обучения. Заходите каждый день, чтобы поддерживать огонь!</li>
          <li><strong>Мастерство наборов:</strong> Кнопки наборов заполняются цветом по мере изучения слов. Когда вы выучите все слова в наборе, кнопка стане <strong>золотой</strong>.</li>
          <li><strong>Профиль:</strong> Нажмите на иконку пользователя, чтобы увидеть детальную статистику за сегодня и за все время.</li>
        </ul>
      </section>
    </>
);

const UkrainianContent: React.FC = () => (
    <>
      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">1. Початок роботи</h2>
        <p>
          На головному екрані ви можете увійти до свого облікового запису Google, а потім натиснути кнопку <strong>"Select Dictionary"</strong>.
        </p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Вхід до акаунту:</strong> Це дозволить синхронізувати ваші словники та прогрес між пристроями.</li>
          <li><strong>Автозавантаження:</strong> Додаток автоматично запам'ятовує останній використаний словник.</li>
          <li><strong>Вибір словника:</strong> Можна обрати вбудований словник, раніше завантажений (My Dictionaries) або завантажити новий файл Excel.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">2. Підготовка файлів</h2>
        <p className="mb-3">
          Для створення власного словника використовуйте Excel (.xlsx). Структура файлу має бути наступною:
        </p>

        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mt-4 mb-2">
            <Table size={16} /> Схема Excel файлу:
        </div>

        <ExcelSchema lang1="English" lang2="Ukrainian" example1="Apple" example2="Яблуко" />

        <ul className="list-disc list-inside space-y-2 mt-3 text-sm">
            <li><strong>Рядок 1 (Заголовок):</strong> Назви мов (наприклад, English, Ukrainian).</li>
            <li><strong>Стовпець A:</strong> Слова мовою, яку вивчаєте.</li>
            <li><strong>Стовпець C:</strong> Переклад.</li>
            <li><strong>Стовпці B та D:</strong> Мають залишатися порожніми (для розділення).</li>
        </ul>
        <p className="mt-3 text-sm text-slate-500 border-l-2 border-indigo-400 pl-3">
            Ви можете розміщувати кілька наборів на одному аркуші, продовжуючи структуру (наступна пара у стовпцях E та G, тощо).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">3. Процес тренування та Керування</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Свайпи (Жести):</strong> На сенсорних екранах змахніть картку <strong>вліво</strong> ("Don't know") або <strong>вправо</strong> ("Know").</li>
          <li><strong>Гарячі клавіші:</strong>
             <ul className="list-disc list-inside pl-5 mt-1 text-sm">
                 <li><strong>Пробіл:</strong> Перевернути картку.</li>
                 <li><strong>1 або Стрілка вліво:</strong> Не знаю (Don't know).</li>
                 <li><strong>2 або Стрілка вправо:</strong> Знаю (Know).</li>
             </ul>
          </li>
          <li><strong>Zen Mode:</strong> Натисніть іконку розширення (стрілки) над карткою, щоб приховати меню та списки, залишивши тільки картку для фокусування.</li>
          <li><strong>Magic Example (ШІ):</strong> Натисніть кнопку з "чарівною паличкою" ✨ у кутку картки. ШІ створить "Розумну картку" з визначенням слова, прикладом використання та корисним словосполученням.</li>
          <li><strong>Налаштування звуку:</strong> Натисніть на шестерню на звороті картки, щоб обрати <strong>голос</strong> (наприклад, Google US English) та <strong>швидкість мовлення</strong>.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">4. Тренування незнайомих слів</h2>
        <p>
          Слова, позначені як <strong>"Don't know"</strong>, можна тренувати окремо.
        </p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Write (Письмово):</strong> Введіть переклад вручну. <strong>Розумний ШІ</strong> перевірить вашу відповідь: він зарахує правильні синонимы та пробачить дрібні помилки.</li>
          <li><strong>Guess (Тест):</strong> Виберіть правильний варіант із запропонованих.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">5. Гейміфікація та Прогрес</h2>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Daily Streak (Вогник):</strong> Іконка вогню в шапці показує серію днів безперервного навчання. Заходьте щодня, щоб підтримувати вогонь!</li>
          <li><strong>Майстерність наборів:</strong> Кнопки наборів заповнюються кольором у міру вивчення слів. Коли ви вивчите всі слова в наборі, кнопка стане <strong>золотою</strong>.</li>
          <li><strong>Профіль:</strong> Натисніть на іконку користувача, щоб побачити детальну статистику за сьогодні та за весь час.</li>
        </ul>
      </section>
    </>
);


export const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  const [lang, setLang] = useState<Language>('ru');

  const title = lang === 'ru' ? "Руководство пользователя" : "Інструкція користувача";

  return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <div className="text-slate-600 dark:text-slate-300 max-h-[70vh] flex flex-col">
          <LanguageToggle lang={lang} setLang={setLang} />
          <div className="overflow-y-auto pr-2 space-y-6 flex-grow">
            {lang === 'ru' ? <RussianContent /> : <UkrainianContent />}
          </div>
        </div>
      </Modal>
  );
};