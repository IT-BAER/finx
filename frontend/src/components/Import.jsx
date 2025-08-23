import { useState } from "react";
import offlineAPI from "../services/offlineAPI";
import Dropdown from "./Dropdown";
import { useTranslation } from "../hooks/useTranslation";
import { transactionAPI } from "../services/api";
import Button from "./Button";

const Import = ({ onClose }) => {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [mappings, setMappings] = useState({});
  const [showMapping, setShowMapping] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Allow CSV and JSON files from the app or other exporters
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/json",
      "text/json",
    ];
    const fileExtension = selectedFile.name.split(".").pop().toLowerCase();
    if (
      !allowedTypes.includes(selectedFile.type) &&
      !["csv", "json"].includes(fileExtension)
    ) {
      setError(t("invalidFileType"));
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError("");
    setDetectedFormat(null);
    setProcessedCount(0);
    setTotalCount(0);

    // Kick off quick detection (reads small portion) and then parse & show mapping automatically for CSV-like files
    detectFileFormat(selectedFile)
      .then((fmt) => {
        // Keep detectedFormat state in sync
        setDetectedFormat(fmt || "unknown");

        // For CSV-like formats (csv or finx/firefly that produce table exports) parse immediately and show mapping UI
        if (fmt === "csv" || fmt === "finx" || fmt === "firefly") {
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const content = ev.target.result;
              // CSV parsing (same logic as in handleImport)
              const lines = content
                .split("\n")
                .filter((line) => line.trim() !== "");
              if (lines.length < 1) {
                setError(t("invalidCSVFormat"));
                return;
              }
              const headers = lines[0].split(",").map((h) => h.trim());
              const rows = [];
              for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(
                  /,(?=(?:(?:[^"]*\"){2})*[^\"]*$)/,
                );
                const row = {};
                for (let j = 0; j < headers.length; j++) {
                  row[headers[j]] = values[j]
                    ? values[j].replace(/"/g, "")
                    : "";
                }
                rows.push(row);
              }

              // Save parsed headers/rows and prepare mapping UI
              setCsvHeaders(headers);
              setCsvRows(rows);

              const guessed = guessMapping(headers);
              // Ensure guessed mappings correspond to actual parsed headers (case-insensitive).
              const normalizedGuessed = {};
              Object.keys(guessed).forEach((k) => {
                const val = guessed[k];
                if (!val) {
                  normalizedGuessed[k] = "";
                  return;
                }
                const found = headers.find(
                  (h) => h.trim().toLowerCase() === val.trim().toLowerCase(),
                );
                normalizedGuessed[k] = found || "";
              });
              setMappings(normalizedGuessed);
              // Show mapping UI immediately
              setShowMapping(true);
            } catch (err) {
              console.error("Failed to parse CSV on file select", err);
              setError(t("invalidCSVFormat"));
            }
          };
          reader.readAsText(selectedFile);
        }
      })
      .catch(() => {
        setDetectedFormat("unknown");
      });
  };

  const detectFileFormat = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const txt = e.target.result;

          // JSON detection - inspect sample object keys to prefer Firefly detection
          if (
            file.name.toLowerCase().endsWith(".json") ||
            file.type.includes("json")
          ) {
            try {
              const json = JSON.parse(txt);
              let sample = null;
              if (Array.isArray(json) && json.length > 0) {
                sample = json[0];
              } else if (
                json &&
                Array.isArray(json.transactions) &&
                json.transactions.length > 0
              ) {
                sample = json.transactions[0];
              }

              if (sample && typeof sample === "object") {
                const keys = Object.keys(sample).map((k) => k.toLowerCase());

                const fireflyIndicators = [
                  "transaction_amount",
                  "withdrawal",
                  "deposit",
                  "counter_account_name",
                  "counter_account",
                  "booked_at",
                  "booking_date",
                  "value_date",
                  "amount",
                  "type",
                ];
                const finxIndicators = [
                  "category_name",
                  "source_name",
                  "target_name",
                  "destination_name",
                  "category_title",
                ];

                const hasFirefly = keys.some((k) =>
                  fireflyIndicators.some((ind) => k.includes(ind)),
                );
                const hasFinX = keys.some((k) =>
                  finxIndicators.some((ind) => k.includes(ind)),
                );

                if (hasFirefly) {
                  setDetectedFormat("firefly");
                  resolve("firefly");
                  return;
                }

                if (hasFinX) {
                  setDetectedFormat("finx");
                  resolve("finx");
                  return;
                }
              }
              // If JSON but structure unknown, treat as generic JSON
              if (
                Array.isArray(json) ||
                (json && Array.isArray(json.transactions))
              ) {
                setDetectedFormat("finx");
                resolve("finx");
                return;
              }
            } catch (err) {
              // not valid JSON
            }
          }

          // CSV detection: inspect headers and content
          const firstLine = txt.split("\n").find((l) => l.trim() !== "");
          const lcTxt = txt.toLowerCase();

          // Quick content check for Firefly marker (ff3- appears in many exports)
          if (lcTxt.includes("ff3-") || lcTxt.includes("firefly")) {
            setDetectedFormat("firefly");
            resolve("firefly");
            return;
          }

          if (firstLine) {
            const headers = firstLine
              .split(",")
              .map((h) => h.trim().toLowerCase());

            // Firefly indicators (match any of these in headers or content)
            const fireflyIndicators = [
              "transaction_amount",
              "withdrawal",
              "deposit",
              "counter_account_name",
              "counter_account",
              "booked_at",
              "book_date",
              "process_date",
              "value_date",
              "import_hash_v2",
              "import_hash",
              "external_id",
              "original_source",
            ];

            const hasFireflyIndicator = fireflyIndicators.some(
              (ind) => headers.includes(ind) || lcTxt.includes(ind),
            );
            const hasTypeAndAmount =
              headers.includes("type") &&
              (headers.includes("amount") ||
                headers.includes("transaction_amount"));

            const hasFirefly = hasFireflyIndicator || hasTypeAndAmount;

            // FinX indicators (weaker; only used if Firefly signals absent)
            const finxIndicators = [
              "category_name",
              "source_name",
              "target_name",
              "destination_name",
              "category_title",
            ];
            const hasFinX = finxIndicators.some((ind) => headers.includes(ind));

            if (hasFirefly) {
              setDetectedFormat("firefly");
              resolve("firefly");
              return;
            }

            if (hasFinX) {
              setDetectedFormat("finx");
              resolve("finx");
              return;
            }
          }

          setDetectedFormat("csv");
          resolve("csv");
        } catch (err) {
          reject(err);
        }
      };

      // Read first chunk to keep detection fast
      const blob = file.slice(0, 64 * 1024);
      reader.readAsText(blob);
    });
  };

  const validateCSVFormat = (csvContent) => {
    const lines = csvContent.split("\n").filter((line) => line.trim() !== "");
    if (lines.length < 2) return false;

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    // Require at least date and amount and description to be present in some form
    const requiredCandidates = [
      ["date"],
      ["amount"],
      ["description", "narrative", "payee"],
    ];

    return requiredCandidates.every((group) =>
      group.some((h) => headers.includes(h)),
    );
  };

  const normalizeRow = (row) => {
    // row: object with header keys (original casing)
    const lower = {};
    Object.keys(row).forEach((k) => {
      lower[k.trim().toLowerCase()] = row[k];
    });

    const pick = (keys) =>
      keys
        .map((k) => k.toLowerCase())
        .find((k) => lower[k] !== undefined && lower[k] !== "");

    const get = (keys) => {
      const k = pick(Array.isArray(keys) ? keys : [keys]);
      return k ? lower[k] : "";
    };

    const rawAmount = (
      get(["amount", "value", "transaction_amount"]) || ""
    ).toString();
    // Normalize amount: remove currency symbols and spaces
    let normalizedAmount = rawAmount.replace(/[^0-9,.-]/g, "");
    // If contains comma and not dot, treat comma as decimal separator
    if (
      normalizedAmount.indexOf(",") !== -1 &&
      normalizedAmount.indexOf(".") === -1
    ) {
      normalizedAmount = normalizedAmount.replace(/,/g, ".");
    }

    return {
      date: get(["date", "transaction_date", "posted_date", "booking_date"]),
      description: get(["description", "narrative", "payee", "note"]),
      amount: normalizedAmount,
      type: get(["type", "transaction_type"]) || "",
      category: get(["category", "category_name", "category_title"]),
      source_name: get(["source_name", "account", "from_account", "source"]),
      destination_name: get([
        "target_name",
        "destination_name",
        "to_account",
        "target",
        "destination",
      ]),
    };
  };

  const appFields = [
    { key: "date", label: t("date") || "Date" },
    { key: "description", label: t("description") || "Description" },
    { key: "amount", label: t("amount") || "Amount" },
    { key: "type", label: t("type") || "Type" },
    { key: "category", label: t("category") || "Category" },
    { key: "source_name", label: t("source") || "Source" },
    { key: "destination_name", label: t("target") || "Target" },
  ];

  const guessMapping = (headers) => {
    const lower = headers.map((h) => h.toLowerCase());
    const map = {};
    const pickHeader = (candidates) => {
      for (const cand of candidates) {
        const idx = lower.findIndex((h) => h.includes(cand));
        if (idx !== -1) return headers[idx];
      }
      return "";
    };

    map.date = pickHeader([
      "date",
      "booking",
      "booked",
      "value_date",
      "posted",
    ]);
    map.amount = pickHeader([
      "amount",
      "value",
      "transaction_amount",
      "withdrawal",
      "deposit",
    ]);
    map.description = pickHeader([
      "description",
      "narrative",
      "payee",
      "note",
      "memo",
    ]);
    map.type = pickHeader(["type", "transaction_type"]);
    map.category = pickHeader(["category", "category_name", "category_title"]);
    map.source_name = pickHeader([
      "source",
      "account",
      "from_account",
      "counter_account",
      "counter_account_name",
    ]);
    map.destination_name = pickHeader([
      "target",
      "destination",
      "to_account",
      "destination_name",
    ]);
    return map;
  };

  const handleImport = async () => {
    if (!file) {
      setError(t("pleaseSelectFileToImport"));
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target.result;

          let parsedRows = [];

          // If JSON file, try to parse as JSON
          if (
            file.name.toLowerCase().endsWith(".json") ||
            file.type.includes("json")
          ) {
            let json;
            try {
              json = JSON.parse(content);
            } catch (jsonErr) {
              setError(t("invalidJSONFile"));
              setLoading(false);
              return;
            }

            // If the app exported an object with transactions key, use it. Otherwise, if it's an array, use it.
            if (Array.isArray(json)) {
              parsedRows = json;
            } else if (json && Array.isArray(json.transactions)) {
              parsedRows = json.transactions;
            } else {
              setError(t("invalidJSONFile"));
              setLoading(false);
              return;
            }
          } else {
            // CSV parsing
            const csv = content;

            if (!validateCSVFormat(csv)) {
              setError(t("invalidCSVFormat"));
              setLoading(false);
              return;
            }

            const lines = csv.split("\n").filter((line) => line.trim() !== "");
            const headers = lines[0].split(",").map((h) => h.trim());

            const rows = [];
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(/,(?=(?:(?:[^"]*\"){2})*[^\"]*$)/);
              const row = {};
              for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = values[j] ? values[j].replace(/"/g, "") : "";
              }
              rows.push(row);
            }

            // Save parsed headers/rows and prepare mapping UI
            setCsvHeaders(headers);
            setCsvRows(rows);
            const guessed = guessMapping(headers);
            // Ensure guessed mappings correspond to actual parsed headers (case-insensitive).
            // If a guessed value doesn't match any header, set to empty so dropdown shows placeholder.
            const normalizedGuessed = {};
            Object.keys(guessed).forEach((k) => {
              const val = guessed[k];
              if (!val) {
                normalizedGuessed[k] = "";
                return;
              }
              const found = headers.find(
                (h) => h.trim().toLowerCase() === val.trim().toLowerCase(),
              );
              normalizedGuessed[k] = found || "";
            });
            setMappings(normalizedGuessed);
            // Show mapping UI and stop processing here. Return immediately so the
            // rest of the import flow doesn't continue while React updates state.
            setShowMapping(true);
            setLoading(false);
            return;
          }

          // If mapping UI will be shown, we stop automatic import here and wait for user to apply mapping.
          if (showMapping) {
            setLoading(false);
            return;
          }

          // Normalize rows to expected import shape (using mapping if provided)
          const normalized = parsedRows.map((r) => {
            if (Object.keys(mappings || {}).length > 0) {
              // Use mappings: mapping value may be a CSV header (use row[header]) or a literal value (use as-is).
              const resolve = (mappingKey) => {
                const m = mappings[mappingKey];
                if (!m) return "";
                // If the parsed row contains the mapping as a key, prefer that value
                if (Object.prototype.hasOwnProperty.call(r, m)) return r[m];
                // Try case-insensitive match (some CSVs may differ in casing)
                const foundKey = Object.keys(r).find(
                  (k) => k.trim().toLowerCase() === m.trim().toLowerCase(),
                );
                if (foundKey) return r[foundKey];
                // Otherwise treat mapping as a literal value provided by the user
                return m;
              };

              return {
                date: resolve("date") || "",
                description: resolve("description") || "",
                amount: resolve("amount") || "",
                type: resolve("type") || "",
                category: resolve("category") || "",
                source_name: resolve("source_name") || "",
                destination_name: resolve("destination_name") || "",
              };
            }
            return normalizeRow(r);
          });

          // Prepare progress counters
          setProcessedCount(0);
          setTotalCount(normalized.length);

          let results = [];
          if (!offlineAPI.isOnline) {
            // Offline: queue each transaction using offlineAPI.createTransaction and update progress per item
            for (const tx of normalized) {
              try {
                const res = await offlineAPI.createTransaction(tx);
                results.push({
                  success: true,
                  transaction: res.transaction || res,
                });
              } catch (err) {
                console.error(
                  "Failed to queue transaction for import:",
                  tx,
                  err,
                );
                results.push({
                  success: false,
                  transaction: tx,
                  error: err.message,
                });
              } finally {
                setProcessedCount((c) => c + 1);
              }
            }
          } else {
            // Online bulk import path: indicate uploading then mark all as processed after response
            results = await transactionAPI.importTransactions(normalized);
            setProcessedCount(results.length || normalized.length);
          }

          // Count successful and failed imports
          const successfulImports = results.filter((r) => r.success).length;
          const failedImports = results.filter((r) => !r.success).length;

          if (failedImports > 0) {
            setError(
              `${t("someTransactionsFailedToImport")}: ${successfulImports} ${t("successful")}, ${failedImports} ${t("failed")}`,
            );
          } else {
            setSuccess(t("transactionsImportedSuccessfully"));
          }

          // Dispatch event to refresh transactions list
          window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));

          // Close the modal after successful import
          setTimeout(() => {
            if (onClose) onClose();
          }, 1500);
        } catch (err) {
          console.error("Failed to import transactions:", err);
          setError(`${t("failedToImportTransactions")}: ${err.message}`);
          setSuccess("");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error("Failed to read file:", err);
      setError(`${t("failedToImportTransactions")}: ${err.message}`);
      setSuccess("");
      setLoading(false);
    }
  };

  // Helper: resolve a value from a parsed CSV row using the selected mapping (case-insensitive)
  const resolveForRowTop = (r, mappingKey) => {
    const m = mappings[mappingKey];
    if (!m) return "";
    if (Object.prototype.hasOwnProperty.call(r, m)) return r[m];
    const foundKey = Object.keys(r).find(
      (k) => k.trim().toLowerCase() === m.trim().toLowerCase(),
    );
    if (foundKey) return r[foundKey];
    return "";
  };

  // Build normalized rows from parsed CSV rows using current mappings (best-effort)
  const buildNormalized = (rows) => {
    if (!rows) return [];
    return rows.map((r) => {
      if (Object.keys(mappings || {}).length > 0) {
        return {
          date: resolveForRowTop(r, "date") || "",
          description: resolveForRowTop(r, "description") || "",
          amount: resolveForRowTop(r, "amount") || "",
          type: resolveForRowTop(r, "type") || "",
          category: resolveForRowTop(r, "category") || "",
          source_name: resolveForRowTop(r, "source_name") || "",
          destination_name: resolveForRowTop(r, "destination_name") || "",
        };
      }
      return normalizeRow(r);
    });
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("selectFile")}
        </label>
        <div className="relative">
          <input
            type="file"
            accept=".csv,.json,text/csv,application/vnd.ms-excel,application/json,text/json"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
          >
            <span className="truncate max-w-[70%]">
              {file ? file.name : t("noFileSelected")}
            </span>
            <span className="ml-2 p-2 bg-blue-200 dark:bg-blue-800 rounded-md flex items-center justify-center">
              <img
                src="/icons/browse.svg"
                alt={t("browse")}
                className="w-5 h-5 icon-tint-accent"
              />
            </span>
          </label>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
          {success && <p className="text-green-500 mt-2 text-sm">{success}</p>}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 ml-2">
          {detectedFormat === "finx" && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-md">
              FinX detected
            </span>
          )}
          {detectedFormat === "firefly" && (
            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 rounded-md">
              Firefly III detected
            </span>
          )}
          {detectedFormat === "csv" && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md">
              CSV detected
            </span>
          )}
          {detectedFormat === "unknown" && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md">
              Unknown format
            </span>
          )}
        </div>
      </div>

      {showMapping && csvHeaders.length > 0 && (
        <div className="mt-4 overflow-y-auto max-h-[50vh]">
          <h3 className="font-medium mb-2">
            {t("mapColumns") || "Map CSV columns"}
          </h3>
          <div className="flex flex-col gap-3">
            {appFields.map((field) => (
              <div key={field.key} className="flex flex-col gap-2 pb-2">
                <div className="text-sm font-medium">{field.label}</div>
                <div>
                  <Dropdown
                    options={[
                      {
                        value: "",
                        label: t("selectHeader") || "Select header",
                      },
                      ...csvHeaders.map((h) => ({ value: h, label: h })),
                    ]}
                    value={mappings[field.key] || ""}
                    onChange={(e) => {
                      const next = { ...mappings };
                      next[field.key] = e.target.value;
                      setMappings(next);
                    }}
                    placeholder={t("selectHeader") || "Select header"}
                    label=""
                    name={field.key}
                    noBorder={true}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalCount > 0 && (
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-3">
          {loading && (
            <div className="spinner w-4 h-4" aria-hidden="true"></div>
          )}
          <div>
            {processedCount} / {totalCount} {t("processed") || "processed"}
          </div>
        </div>
      )}
      <div className="flex justify-end space-x-3 mt-6">
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={async () => {
            // If mapping UI is visible, perform import using mappings and parsed csvRows.
            if (showMapping && csvRows && csvRows.length > 0) {
              setLoading(true);
              try {
                const parsedRows = csvRows || [];
                const resolveForRow = (r, mappingKey) => {
                  const m = mappings[mappingKey];
                  if (!m) return "";
                  if (Object.prototype.hasOwnProperty.call(r, m)) return r[m];
                  const foundKey = Object.keys(r).find(
                    (k) => k.trim().toLowerCase() === m.trim().toLowerCase(),
                  );
                  if (foundKey) return r[foundKey];
                  return "";
                };
                const normalized = parsedRows.map((r) => ({
                  date: resolveForRow(r, "date") || "",
                  description: resolveForRow(r, "description") || "",
                  amount: resolveForRow(r, "amount") || "",
                  type: resolveForRow(r, "type") || "",
                  category: resolveForRow(r, "category") || "",
                  source_name: resolveForRow(r, "source_name") || "",
                  destination_name: resolveForRow(r, "destination_name") || "",
                }));

                let results = [];
                if (!offlineAPI.isOnline) {
                  for (const tx of normalized) {
                    try {
                      const res = await offlineAPI.createTransaction(tx);
                      results.push({
                        success: true,
                        transaction: res.transaction || res,
                      });
                    } catch (err) {
                      results.push({
                        success: false,
                        transaction: tx,
                        error: err.message,
                      });
                    } finally {
                      setProcessedCount((c) => c + 1);
                    }
                  }
                } else {
                  results = await transactionAPI.importTransactions(normalized);
                  setProcessedCount(results.length || normalized.length);
                }

                const successfulImports = results.filter(
                  (r) => r.success,
                ).length;
                const failedImports = results.filter((r) => !r.success).length;

                if (failedImports > 0) {
                  setError(
                    `${t("someTransactionsFailedToImport")}: ${successfulImports} ${t("successful")}, ${failedImports} ${t("failed")}`,
                  );
                } else {
                  setSuccess(t("transactionsImportedSuccessfully"));
                }

                window.dispatchEvent(new CustomEvent("dataRefreshNeeded"));
                setTimeout(() => {
                  if (onClose) onClose();
                }, 1500);
              } catch (err) {
                console.error("Import using mapping failed", err);
                setError(`${t("failedToImportTransactions")}: ${err.message}`);
              } finally {
                setLoading(false);
              }
              return;
            }

            // Otherwise proceed with the initial import/detection flow
            await handleImport();
          }}
          disabled={!file || loading}
        >
          {loading ? (
            <div className="flex items-center">
              <div className="spinner mr-2"></div>
              {t("importing")}
            </div>
          ) : (
            t("import")
          )}
        </Button>
      </div>
    </div>
  );
};

export default Import;
