import { useEffect } from "react";
import offlineAPI from "../services/offlineAPI";

const Export = () => {
  useEffect(() => {
    const handleExport = async () => {
      try {
        const transactions = await offlineAPI.getAllTransactions();
        const headers = [
          "date",
          "description",
          "amount",
          "type",
          "category_name",
          "source_name",
          "target_name",
        ];
        const csv = [
          headers.join(","),
          ...transactions.map((t) =>
            [
              t.date,
              t.description,
              t.amount,
              t.type,
              t.category_name,
              t.source_name,
              t.target_name,
            ].join(","),
          ),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "transactions.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Failed to export transactions:", err);
      }
    };

    handleExport();
  }, []);

  return null;
};

export default Export;
