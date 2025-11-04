import React, { useState } from 'react';
import { Modal } from './Modal';

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

const RussianContent: React.FC = () => (
    <>
      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">1. Начало работы</h2>
        <p>
            На главном экране вы можете войти в свой аккаунт Google, а затем нажать кнопку <strong>"Select Dictionary"</strong>.
        </p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Вход в аккаунт:</strong> Это позволит синхронизировать ваши словари и прогресс между устройствами.</li>
          <li><strong>Автозагрузка:</strong> Приложение автоматически запоминает и загружает последний использованный вами словарь, чтобы вы могли быстро продолжить обучение.</li>
          <li><strong>Выбор словаря:</strong> Откроется окно, где вы можете выбрать источник слов:
            <ul className="list-disc list-inside pl-5 mt-1 space-y-1">
              <li><strong>Built-in:</strong> Выбрать один из готовых, встроенных словарей.</li>
              <li><strong>My Dictionaries:</strong> Выбрать из словарей, которые вы ранее загрузили. Новые словари автоматически синхронизируются с облаком, если вы вошли в систему.</li>
              <li><strong>From Computer:</strong> Загрузить собственный файл со словами в формате Excel (.xlsx). Он будет сохранен для будущих сессий.</li>
            </ul>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">2. Подготовка файлов</h2>

        <h3 className="text-lg font-semibold mb-1 text-slate-800 dark:text-slate-100">Словарь (.xlsx)</h3>
        <p className="mb-3">
          Чтобы создать собственный набор карточек, ваш файл Excel должен иметь четкую структуру. Для автоматического определения языков рекомендуется добавить заголовок в первой строке:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Строка 1 (Заголовок):</strong> Введите название языка в соответствующий столбец (например, "Русский" в A1, "Английский" в C1).</li>
          <li><strong>Строка 2 и далее (Слова):</strong>
            <ul className="list-disc list-inside pl-5 mt-1">
              <li><strong>Столбец A:</strong> Слово на первом языке.</li>
              <li><strong>Столбец B:</strong> <em>Должен быть пустым.</em></li>
              <li><strong>Столбец C:</strong> Перевод на второй язык.</li>
              <li><strong>Столбец D:</strong> <em>Должен быть пустым.</em></li>
            </ul>
          </li>
        </ul>
        <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">Пример структуры:</p>
          <pre className="font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-xs leading-relaxed"><code>
{`|      А      | B |      C       |
|-------------|---|--------------|
|   Русский   |   |  Английский  | <-- Строка заголовка
|-------------|---|--------------|
|     кот     |   |     cat      | <-- Строки со словами
|    собака   |   |     dog      |`}
        </code></pre>
        </div>
        <p className="mt-3">
          Вы можете размещать несколько наборов слов на одном листе. Следующий набор будет начинаться со столбца <strong>E</strong>, затем <strong>I</strong>, и так далее (каждые 4 столбца).
        </p>
        <p className="mt-3">
          <strong>Примечание:</strong> Если вы загрузите файл без строки заголовка, он все равно будет работать, но языки будут названы обобщенно (например, "Language A", "Language C").
        </p>

        <h3 className="text-lg font-semibold mt-4 mb-1 text-slate-800 dark:text-slate-100">Предложения-примеры (необязательно)</h3>
        <p className="mb-3">
          Чтобы видеть слова в контексте, вы можете загрузить файл с примерами на экране тренировки. Этот файл предназначен для примеров на английском языке.
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Формат .xlsx:</strong> <strong>Столбец A</strong> — английское слово, <strong>Столбец B</strong> — предложение-пример.</li>
          <li><strong>Формат .json:</strong> Объект, где ключ — английское слово (в нижнем регистре), а значение — предложение.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">3. Процесс тренировки</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Выбор набора:</strong> После загрузки файла выберите один из доступных наборов слов для начала.</li>
          <li><strong>Интервальное повторение:</strong> Приложение показывает только те слова, которые являются новыми или время которых пришло для повторения.</li>
          <li><strong>Кнопки "Know" / "Don't know":</strong> Нажатие <strong>"Know"</strong> увеличивает интервал до следующего показа слова. Нажатие <strong>"Don't know"</strong> сбрасывает прогресс, и слово появится в следующей сессии.</li>
          <li><strong>Переворачивание карточки:</strong> Нажмите на карточку, чтобы увидеть перевод.</li>
          <li><strong>Прослушивание:</strong> Нажмите иконку динамика, чтобы услышать произношение (только на английском).</li>
          <li><strong>Перемешать:</strong> Нажмите иконку "Shuffle", чтобы перемешать слова в текущем наборе.</li>
          <li><strong>Список слов:</strong> Нажмите иконку "List", чтобы показать полный список слов в текущем наборе.</li>
          <li><strong>Направление перевода:</strong> Используйте переключатель (например, "Русский ↔ Английский"), чтобы изменить направление тренировки.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">4. Тренировка незнакомых слов</h2>
        <p>
          Слова, которые вы помечаете как <strong>"Don't know"</strong>, сохраняются в отдельном списке для каждого набора. После завершения основной сессии появится кнопка для их тренировки, что позволит вам сосредоточиться на самом сложном материале. Доступны два режима:
        </p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Write:</strong> Введите перевод вручную.</li>
          <li><strong>Guess:</strong> Выберите правильный перевод из предложенных вариантов.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">5. Управление прогрессом</h2>
        <p>
          Ваш прогресс (выученные и незнакомые слова) сохраняется автоматически.
        </p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Если вы вошли в систему:</strong> С помощью аккаунта Google ваш прогресс сохраняется в облаке, что позволяет вам продолжать обучение на любом устройстве.</li>
          <li><strong>Если вы не вошли в систему:</strong> Ваш прогресс сохраняется локально в вашем браузере. Вы можете продолжить с того места, где остановились, на том же компьютере, но ваш прогресс не будет доступен на других устройствах.</li>
        </ul>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Learned:</strong> Открывает окно со списком всех слов, которые вы отметили как "Know".</li>
          <li><strong>Reset:</strong> Полностью удаляет весь сохраненный прогресс для текущего словаря. Это действие необратимо.</li>
          <li><strong>Change:</strong> Позволяет сменить текущий словарь.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">6. Отслеживание прогресса (Профиль)</h2>
        <p>Нажмите на иконку профиля (иконка пользователя) в правом верхнем углу, чтобы открыть окно статистики. В этом окне вы найдете две вкладки:</p>
        <ul className="list-disc list-inside space-y-2 mt-3">
            <li><strong>Current:</strong> Показывает подробную статистику по текущему активному словарю: количество выученных слов, незнакомых и оставшихся для изучения.</li>
            <li><strong>All-Time:</strong> Отображает вашу общую статистику по всем словарям, которые вы когда-либо изучали, включая общее количество выученных слов и количество изученных словарей.</li>
        </ul>
        <p className="mt-3">На вкладке "All-Time" также есть кнопка <strong>"Reset All Statistics"</strong>, которая позволяет полностью удалить всю вашу историю обучения. Это действие необратимо.</p>
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
          <li><strong>Автозавантаження:</strong> Додаток автоматично запам'ятовує та завантажує останній використаний вами словник, щоб ви могли швидко продовжити навчання.</li>
          <li><strong>Вибір словника:</strong> Відкриється вікно, де ви можете обрати джерело слів:
            <ul className="list-disc list-inside pl-5 mt-1 space-y-1">
              <li><strong>Built-in:</strong> Вибрати один із готових, вбудованих словників.</li>
              <li><strong>My Dictionaries:</strong> Вибрати зі словників, які ви раніше завантажили. Нові словники автоматично синхронізуються з хмарою, якщо ви увійшли до системи.</li>
              <li><strong>From Computer:</strong> Завантажити власний файл зі словами у форматі Excel (.xlsx). Його буде збережено для майбутніх сесій.</li>
            </ul>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">2. Підготовка файлів</h2>

        <h3 className="text-lg font-semibold mb-1 text-slate-800 dark:text-slate-100">Словник (.xlsx)</h3>
        <p className="mb-3">
          Щоб створити власний набір карток, ваш файл Excel повинен мати чітку структуру. Для автоматичного визначення мов рекомендується додати заголовок у першому рядку:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Рядок 1 (Заголовок):</strong> Введіть назву мови у відповідний стовпець (наприклад, "Українська" в A1, "Англійська" в C1).</li>
          <li><strong>Рядок 2 і далі (Слова):</strong>
            <ul className="list-disc list-inside pl-5 mt-1">
              <li><strong>Стовпець A:</strong> Слово першою мовою.</li>
              <li><strong>Стовпець B:</strong> <em>Має бути порожнім.</em></li>
              <li><strong>Стовпець C:</strong> Переклад другою мовою.</li>
              <li><strong>Стовпець D:</strong> <em>Має бути порожнім.</em></li>
            </ul>
          </li>
        </ul>
        <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">Приклад структури:</p>
          <pre className="font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-xs leading-relaxed"><code>
{`|      А      | B |      C       |
|-------------|---|--------------|
| Українська  |   |  Англійська  | <-- Рядок заголовка
|-------------|---|--------------|
|      кіт    |   |     cat      | <-- Рядки зі словами
|    собака   |   |     dog      |`}
        </code></pre>
        </div>
        <p className="mt-3">
          Ви можете розміщувати кілька наборів слів на одному аркуші. Наступний набір починатиметься зі стовпця <strong>E</strong>, потім <strong>I</strong>, і так далі (кожні 4 стовпці).
        </p>
        <p className="mt-3">
          <strong>Примітка:</strong> Якщо ви завантажите файл без рядка заголовка, він все одно працюватиме, але мови будуть названі узагальнено (наприклад, "Language A", "Language C").
        </p>

        <h3 className="text-lg font-semibold mt-4 mb-1 text-slate-800 dark:text-slate-100">Речення-приклади (необов'язково)</h3>
        <p className="mb-3">
          Щоб бачити слова в контексті, ви можете завантажити файл із прикладами на екрані тренування. Цей файл призначений для прикладів англійською мовою.
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Формат .xlsx:</strong> <strong>Стовпець A</strong> — англійське слово, <strong>Стовпець B</strong> — речення-приклад.</li>
          <li><strong>Формат .json:</strong> Об'єкт, де ключ — англійське слово (в нижньому регістрі), а значення — речення.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">3. Процес тренування</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Вибір набору:</strong> Після завантаження файлу оберіть один із доступних наборів слів для початку.</li>
          <li><strong>Інтервальне повторення:</strong> Додаток показує лише ті слова, які є новими або час яких настав для повторення.</li>
          <li><strong>Кнопки "Know" / "Don't know":</strong> Натискання <strong>"Know"</strong> збільшує інтервал до наступного показу слова. Натискання <strong>"Don't know"</strong> скидає прогрес, і слово з'явиться в наступній сесії.</li>
          <li><strong>Перегортання картки:</strong> Натисніть на картку, щоб побачити переклад.</li>
          <li><strong>Прослуховування:</strong> Натисніть іконку динаміка, щоб почути вимову (тільки англійською).</li>
          <li><strong>Перемішати:</strong> Натисніть іконку "Shuffle", щоб перемішати слова в поточному наборі.</li>
          <li><strong>Список слів:</strong> Натисніть іконку "List", щоб показати повний список слів у поточному наборі.</li>
          <li><strong>Напрямок перекладу:</strong> Використовуйте перемикач (наприклад, "Українська ↔ Англійська"), щоб змінити напрямок тренування.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">4. Тренування незнайомих слів</h2>
        <p>
          Слова, які ви позначаєте як <strong>"Don't know"</strong>, зберігаються в окремому списку для кожного набору. Після завершення основної сесії з'явиться кнопка для їх тренування, що дозволить вам зосередитися на найскладнішому матеріалі. Доступні два режими:
        </p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Write:</strong> Введіть переклад вручну.</li>
          <li><strong>Guess:</strong> Виберіть правильний переклад із запропонованих варіантів.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">5. Керування прогресом</h2>
        <p>
          Ваш прогрес (вивчені та незнайомі слова) зберігається автоматично.
        </p>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Якщо ви увійшли в систему:</strong> За допомогою облікового запису Google ваш прогрес зберігається в хмарі, що дозволяє вам продовжувати навчання на будь-якому пристрої.</li>
          <li><strong>Якщо ви не увійшли в систему:</strong> Ваш прогрес зберігається локально у вашому браузері. Ви можете продовжити з того місця, де зупинилися, на тому ж комп'ютері, але ваш прогрес не буде доступний на інших пристроях.</li>
        </ul>
        <ul className="list-disc list-inside space-y-2 mt-3">
          <li><strong>Learned:</strong> Відкриває вікно зі списком усіх слів, які ви відзначили як "Know".</li>
          <li><strong>Reset:</strong> Повністю видаляє весь збережений прогрес для поточного словника. Ця дія незворотна.</li>
          <li><strong>Change:</strong> Дозволяє змінити поточний словник.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2 text-indigo-600 dark:text-indigo-400">6. Відстеження прогресу (Профіль)</h2>
        <p>Натисніть на іконку профілю (іконка користувача) у верхньому правому куті, щоб відкрити вікно статистики. У цьому вікні ви знайдете дві вкладки:</p>
        <ul className="list-disc list-inside space-y-2 mt-3">
            <li><strong>Current:</strong> Показує детальну статистику для поточного активного словника: кількість вивчених слів, незнайомих та тих, що залишилися для вивчення.</li>
            <li><strong>All-Time:</strong> Відображає вашу загальну статистику по всіх словниках, які ви коли-небудь вивчали, включаючи загальну кількість вивчених слів та кількість вивчених словників.</li>
        </ul>
        <p className="mt-3">На вкладці "All-Time" також є кнопка <strong>"Reset All Statistics"</strong>, яка дозволяє повністю видалити всю вашу історію навчання. Ця дія незворотна.</p>
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