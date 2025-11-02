import React from 'react';
import { Modal } from './Modal';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Instruction Manual">
      <div className="text-slate-300 max-h-[70vh] overflow-y-auto pr-2 space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">1. Getting Started</h2>
          <p>
            On the main screen, click the <strong>"Get Started"</strong> button. A window will open where you can choose your word source:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li><strong>Built-in:</strong> Select from pre-packaged dictionaries. Some include example sentence files.</li>
            <li><strong>From Computer:</strong> Upload your own word file in Excel (.xlsx) format.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">2. Preparing Your Files</h2>
          
          <h3 className="text-lg font-semibold mb-1 text-slate-100">Word Dictionary (.xlsx)</h3>
          <p className="mb-3">
            To create your own flashcard set, your Excel file should follow a clear structure. For language auto-detection, add a header in the first row:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Row 1 (Header):</strong> Enter the name of the language in the corresponding column (e.g., "Spanish" in A1, "English" in C1). This is now the recommended way.</li>
            <li><strong>Row 2 onwards (Words):</strong>
                <ul>
                    <li><strong>Column A:</strong> Word in the first language.</li>
                    <li><strong>Column B:</strong> <em>Should be empty.</em></li>
                    <li><strong>Column C:</strong> Translation in the second language.</li>
                    <li><strong>Column D:</strong> <em>Should be empty.</em></li>
                </ul>
            </li>
          </ul>
          <div className="mt-4 p-3 bg-slate-900 rounded-lg">
            <p className="font-mono text-xs text-slate-400">Example structure for multiple sets:</p>
            <pre className="text-slate-300 whitespace-pre-wrap text-xs"><code>
{`|     A     | B |      C      | D |      E     | F |       G      |
|-----------|---|-------------|---|------------|---|--------------|
|  Spanish  |   |   English   |   |   German   |   |   English    | <-- Header Row
|-----------|---|-------------|---|------------|---|--------------|
|   gato    |   |     cat     |   |   Katze    |   |     cat      | <-- Word Rows
|   perro   |   |     dog     |   |    Hund    |   |     dog      |`}
            </code></pre>
          </div>
          <p className="mt-3">
            You can place multiple word sets on the same sheet. The next set will start in column <strong>E</strong>, then <strong>I</strong>, and so on (every 4 columns).
          </p>
           <p className="mt-3">
            <strong>Note:</strong> If you upload a file without a header row, it will still work, but languages will be named generically (e.g., "Language A", "Language C").
          </p>

          <h3 className="text-lg font-semibold mt-4 mb-1 text-slate-100">Example Sentences (Optional)</h3>
          <p className="mb-3">
            To see words in context, you can upload a file with examples on the training screen. This file should be for English examples.
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>.xlsx Format:</strong> <strong>Column A</strong> — English word, <strong>Column B</strong> — example sentence.</li>
            <li><strong>.json Format:</strong> An object where the key is the English word (lowercase) and the value is the sentence.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">3. The Training Process</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Set Selection:</strong> After uploading a file, choose one of the available word sets to begin.</li>
            <li><strong>Spaced Repetition:</strong> The app only shows words that are new or due for review.</li>
            <li><strong>"Know" / "Don't know" Buttons:</strong> Clicking <strong>"Know"</strong> increases the interval until the next review. Clicking <strong>"Don't know"</strong> resets the progress, and the word will appear in the next session.</li>
            <li><strong>Flipping the Card:</strong> Click the card to see the translation.</li>
            <li><strong>Listening:</strong> Click the speaker icon to hear high-quality pronunciation (English only).</li>
            <li><strong>Shuffle:</strong> Click the shuffle icon to randomize the current word set.</li>
            <li><strong>Word List:</strong> Click the list icon to show the full list of words in the current set.</li>
            <li><strong>Translation Direction:</strong> Use the toggle (e.g., "Spanish ↔ English") to switch between forward and reverse translation practice.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">4. Training Unknown Words</h2>
          <p>
            Words you mark as <strong>"Don't know"</strong> are saved in a separate list for each set. After completing the main session, a button will appear to train these words, allowing you to focus on the most challenging material in either "Write" or "Guess" mode.
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">5. Managing Progress</h2>
          <p>
            All your progress (learned and unknown words) is stored in your account, linked to the specific dictionary file.
          </p>
           <ul className="list-disc list-inside space-y-2 mt-3">
                <li><strong>Learned:</strong> Opens a window listing all words you've marked as "Know," showing their current learning stage.</li>
                <li><strong>Reset:</strong> Completely erases all saved progress for the current dictionary. This is irreversible.</li>
                <li><strong>Change:</strong> Lets you switch to a different dictionary.</li>
            </ul>
        </section>
      </div>
    </Modal>
  );
};
