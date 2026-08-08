import re

with open('src/pages/QuizHub.tsx', 'r') as f:
    content = f.read()

pattern = r"const interval = setInterval\(async \(\) => \{.*?\n        \}, 3000\);"
replacement = """const interval = setInterval(async () => {
          if (isCancelled || !videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const videoEl = videoRef.current;
            
            // 1. Detect cell phones (coco-ssd)
            const predictions = await cocoModel.detect(videoEl);
            const hasPhone = predictions.some((pred: any) => pred.class === 'cell phone');
            
            // 2. Detect multiple faces (blazeface)
            const faces = await faceModel.estimateFaces(videoEl, false);
            // Increase Confidence: Set the face detection model's minimum confidence score threshold to 0.85
            const highConfidenceFaces = faces.filter((f: any) => {
              const prob = Array.isArray(f.probability) ? f.probability[0] : f.probability;
              return prob > 0.85;
            });

            let isViolation = false;
            let violationType = '';

            if (hasPhone) {
              isViolation = true;
              violationType = 'Cell Phone Detected';
            } else if (highConfidenceFaces.length > 1) {
              isViolation = true;
              violationType = 'Multiple People Detected';
            } else if (highConfidenceFaces.length === 0) {
              isViolation = true;
              violationType = 'No Face Detected';
            }

            if (isViolation) {
              strikeCount.current += 1;
              console.log(`AI Detected: ${violationType} (Strike ${strikeCount.current})`);
              
              if (strikeCount.current >= 3) {
                setAiWarning(`Warning: ${violationType}. Please ensure your face is visible and no phones are in view.`);
                const now = Date.now();
                if (now - lastUploadTimeRef.current > 45000) { // 45-second throttling lock
                  lastUploadTimeRef.current = now;
                  
                  await updateDoc(doc(db, 'attempts', activeAttemptId), {
                    cheatFlags: arrayUnion(`AI Flag: ${violationType}`)
                  });
                  
                  // Capture image asynchronously
                  captureAndUploadSnapshot(violationType.replace(/ /g, '_')).then(async (driveUrl) => {
                    if (driveUrl) {
                      const logMsg = `AI Flag: ${violationType} [Proof Link: ${driveUrl}]`;
                      
                      // Update firestore attempt log dynamically
                      await updateDoc(doc(db, 'attempts', activeAttemptId), {
                        cheatFlags: arrayUnion(logMsg),
                        updatedAt: serverTimestamp()
                      });
                    }
                  });
                }
              }
            } else {
              strikeCount.current = 0;
              setAiWarning('');
            }
          } catch (err) {
            console.error('AI Frame detection evaluation error:', err);
          }
        }, 2000);"""

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/pages/QuizHub.tsx', 'w') as f:
    f.write(new_content)
