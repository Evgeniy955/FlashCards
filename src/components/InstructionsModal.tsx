import React, { useState } from 'react';
import { Modal } from './Modal';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Language = 'uk' | 'ru';

const instructions = {
  uk: {
    title: "User Guide",
    getStarted: "1. Початок роботи",
    getStartedP1: `На головному екрані натисніть кнопку "Get Started". Відкриється вікно, де ви можете обрати джерело слів:`,
    getStartedLi1: "Built-in: Вибрати один із готових, вбудованих словників.",
    getStartedLi2: "From Computer: Завантажити власний файл зі словами у форматі Excel (.xlsx).",
    prepareFiles: "2. Підготовка файлу Excel",
    prepareFilesP1: `Щоб створити власний набір карток, ваш файл Excel має відповідати чіткій структурі. Для автоматичного визначення мов додайте заголовок у першому рядку:`,
    prepareFilesLi1: `Рядок 1 (Заголовок): Введіть назву мови у відповідну колонку (наприклад, "Іспанська" в A1, "Англійська" в C1). Це рекомендований спосіб.`,
    prepareFilesLi2: `Рядок 2 і далі (Слова):`,
    prepareFilesLi2_1: `Колонка A: Слово першою мовою.`,
    prepareFilesLi2_2: `Колонка B: Має бути порожньою.`,
    prepareFilesLi2_3: `Колонка C: Переклад другою мовою.`,
    prepareFilesLi2_4: `Колонка D: Має бути порожньою.`,
    exampleStructure: "Приклад структури:",
    exampleP1: "Ви можете розміщувати кілька наборів слів на одному аркуші. Наступний набір починатиметься з колонки E, потім I, і так далі (з кроком у 4 колонки).",
    exampleP2: "Примітка: Якщо ви завантажите файл без рядка заголовка, він все одно працюватиме, але мови будуть названі загально (наприклад, \"Language A\").",
    sentencesTitle: "Речення-приклади (опціонально)",
    sentencesP1: "Щоб бачити слова в контексті, завантажте файл із прикладами. Цей файл має містити приклади англійською.",
    trainingProcess: "3. Процес тренування",
    trainingLi1: `Вибір набору: Після завантаження файлу оберіть один із доступних наборів слів для початку.`,
    trainingLi2: `Інтервальне повторення: Додаток показує лише ті слова, які є новими або час яких настав для повторення.`,
    trainingLi3: `Кнопки "Know" / "Don't know": Натискання "Know" збільшує інтервал до наступного показу слова. Натискання "Don't know" скидає прогрес, і слово з'явиться в наступній сесії.`,
    trainingLi4: `Перевертання картки: Натисніть на картку, щоб побачити переклад.`,
    trainingLi5: `Прослуховування: Натисніть іконку динаміка, щоб почути вимову (англійською).`,
    trainingLi6: `Перемішування: Натисніть іконку перемішування, щоб рандомізувати поточний набір слів.`,
    trainingLi7: `Список слів: Натисніть іконку списку, щоб показати повний перелік слів у поточному наборі.`,
    trainingLi8: `Напрямок перекладу: Використовуйте перемикач (напр., "Іспанська ↔ Англійська"), щоб змінити напрямок тренування.`,
    trainMistakes: "4. Тренування незнайомих слів",
    trainMistakesP1: `Слова, які ви позначаєте як "Don't know", зберігаються в окремому списку для кожного набору. Після завершення основної сесії з'явиться кнопка для тренування цих слів, що дозволить вам зосередитися на найскладнішому матеріалі в режимах "Write" або "Guess".`,
    manageProgress: "5. Керування прогресом",
    manageProgressP1: "Весь ваш прогрес (вивчені та невідомі слова) зберігається у вашому акаунті, прив'язаному до конкретного словника.",
    manageLi1: `Learned: Відкриває вікно зі списком усіх слів, які ви позначили як "Know", показуючи їхню поточну стадію вивчення.`,
    manageLi2: `Reset: Повністю видаляє весь збережений прогрес для поточного словника. Ця дія незворотна.`,
    manageLi3: `Change: Дозволяє змінити поточний словник на інший.`,
  },
  ru: {
    title: "User Guide",
    getStarted: "1. Начало работы",
    getStartedP1: `На главном экране нажмите кнопку "Get Started". Откроется окно, где вы можете выбрать источник слов:`,
    getStartedLi1: "Built-in: Выбрать один из готовых, встроенных словарей.",
    getStartedLi2: "From Computer: Загрузить собственный файл со словами в формате Excel (.xlsx).",
    prepareFiles: "2. Подготовка файла Excel",
    prepareFilesP1: `Чтобы создать собственный набор карточек, ваш файл Excel должен соответствовать четкой структуре. Для автоматического определения языков добавьте заголовок в первой строке:`,
    prepareFilesLi1: `Строка 1 (Заголовок): Введите название языка в соответствующую колонку (например, "Испанский" в A1, "Английский" в C1). Это рекомендуемый способ.`,
    prepareFilesLi2: `Строка 2 и далее (Слова):`,
    prepareFilesLi2_1: `Колонка A: Слово на первом языке.`,
    prepareFilesLi2_2: `Колонка B: Должна быть пустой.`,
    prepareFilesLi2_3: `Колонка C: Перевод на второй язык.`,
    prepareFilesLi2_4: `Колонка D: Должна быть пустой.`,
    exampleStructure: "Пример структуры:",
    exampleP1: "Вы можете размещать несколько наборов слов на одном листе. Следующий набор будет начинаться с колонки E, затем I, и так далее (с шагом в 4 колонки).",
    exampleP2: "Примечание: Если вы загрузите файл без строки заголовка, он все равно будет работать, но языки будут названы обобщенно (например, \"Language A\").",
    sentencesTitle: "Предложения-примеры (опционально)",
    sentencesP1: "Чтобы видеть слова в контексте, загрузите файл с примерами. Этот файл должен содержать примеры на английском.",
    trainingProcess: "3. Процесс тренировки",
    trainingLi1: `Выбор набора: После загрузки файла выберите один из доступных наборов слов для начала.`,
    trainingLi2: `Интервальное повторение: Приложение показывает только те слова, которые являются новыми или время которых пришло для повторения.`,
    trainingLi3: `Кнопки "Know" / "Don't know": Нажатие "Know" увеличивает интервал до следующего показа слова. Нажатие "Don't know" сбрасывает прогресс, и слово появится в следующей сессии.`,
    trainingLi4: `Переворачивание карточки: Нажмите на карточку, чтобы увидеть перевод.`,
    trainingLi5: `Прослушивание: Нажмите иконку динамика, чтобы услышать произношение (на английском).`,
    trainingLi6: `Перемешивание: Нажмите иконку перемешивания, чтобы рандомизировать текущий набор слов.`,
    trainingLi7: `Список слов: Нажмите иконку списка, чтобы показать полный перечень слов в текущем наборе.`,
    trainingLi8: `Направление перевода: Используйте переключатель (напр., "Испанский ↔ Английский"), чтобы изменить направление тренировки.`,
    trainMistakes: "4. Тренировка незнакомых слов",
    trainMistakesP1: `Слова, которые вы помечаете как "Don't know", сохраняются в отдельном списке для каждого набора. После завершения основной сессии появится кнопка для тренировки этих слов, что позволит вам сосредоточиться на самом сложном материале в режимах "Write" или "Guess".`,
    manageProgress: "5. Управление прогрессом",
    manageProgressP1: "Весь ваш прогресс (выученные и неизвестные слова) сохраняется в вашем аккаунте, привязанном к конкретному словарю.",
    manageLi1: `Learned: Открывает окно со списком всех слов, которые вы отметили как "Know", показывая их текущую стадию изучения.`,
    manageLi2: `Reset: Полностью удаляет весь сохраненный прогресс для текущего словаря. Это действие необратимо.`,
    manageLi3: `Change: Позволяет сменить текущий словарь.`,
  }
};

const LangToggle: React.FC<{ language: Language, setLanguage: (lang: Language) => void }> = ({ language, setLanguage }) => (
    <div className="flex items-center justify-center p-1 bg-slate-700 rounded-lg mb-4">
        <button
            onClick={() => setLanguage('uk')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${language === 'uk' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
        >
            UA
        </button>
        <button
            onClick={() => setLanguage('ru')}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${language === 'ru' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
        >
            RU
        </button>
    </div>
);


export const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  const [language, setLanguage] = useState<Language>('uk');
  const content = instructions[language];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={content.title}>
      <LangToggle language={language} setLanguage={setLanguage} />
      <div className="text-slate-300 max-h-[70vh] overflow-y-auto pr-2 space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">{content.getStarted}</h2>
          <p>{content.getStartedP1}</p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li>{content.getStartedLi1}</li>
            <li>{content.getStartedLi2}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">{content.prepareFiles}</h2>
          <p className="mb-3">{content.prepareFilesP1}</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>{content.prepareFilesLi1}</strong></li>
            <li><strong>{content.prepareFilesLi2}</strong>
                <ul className="list-circle list-inside ml-4">
                    <li>{content.prepareFilesLi2_1}</li>
                    <li><em>{content.prepareFilesLi2_2}</em></li>
                    <li>{content.prepareFilesLi2_3}</li>
                    <li><em>{content.prepareFilesLi2_4}</em></li>
                </ul>
            </li>
          </ul>
          <div className="mt-4 p-3 bg-slate-900 rounded-lg">
            <p className="font-mono text-xs text-slate-400">{content.exampleStructure}</p>
            <pre className="text-slate-300 whitespace-pre-wrap text-xs mt-2"><code>
{`|     A     | B |      C      | D |
|-----------|---|-------------|---|
|  Spanish  |   |   English   |   | <-- Header
|-----------|---|-------------|---|
|   gato    |   |     cat     |   | <-- Word
|   perro   |   |     dog     |   |`}
            </code></pre>
          </div>
          <p className="mt-3">{content.exampleP1}</p>
          <p className="mt-3">{content.exampleP2}</p>
          <h3 className="text-lg font-semibold mt-4 mb-1 text-slate-100">{content.sentencesTitle}</h3>
          <p>{content.sentencesP1}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">{content.trainingProcess}</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>{content.trainingLi1}</li>
            <li>{content.trainingLi2}</li>
            <li>{content.trainingLi3}</li>
            <li>{content.trainingLi4}</li>
            <li>{content.trainingLi5}</li>
            <li>{content.trainingLi6}</li>
            <li>{content.trainingLi7}</li>
            <li>{content.trainingLi8}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">{content.trainMistakes}</h2>
          <p>{content.trainMistakesP1}</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">{content.manageProgress}</h2>
          <p>{content.manageProgressP1}</p>
           <ul className="list-disc list-inside space-y-2 mt-3">
                <li>{content.manageLi1}</li>
                <li>{content.manageLi2}</li>
                <li>{content.manageLi3}</li>
            </ul>
        </section>
      </div>
    </Modal>
  );
};