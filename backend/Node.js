import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/chat", async (req,res)=>{

    const { prompt } = req.body;

    try{

        // CALL YOUR LLM API HERE

        // Example:
        // OpenAI
        // Gemini
        // Groq
        // Together AI
        // Ollama

        const aiText = "AI response here...";

        res.json({
            reply: aiText
        });

    }
    catch(err){

        res.status(500).json({
            error:"API Failed"
        });
    }
});

app.listen(5000, ()=>{
    console.log("Server running...");
});