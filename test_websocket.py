import json
import threading
import time

from websockets.sync.client import connect


URL = "ws://localhost:8000/ws/interviews/1"


def recruiter():
    with connect(URL) as ws:
        print("Recruiter connected")
        print("Recruiter:", ws.recv())

        message = ws.recv()
        print("Recruiter received:", message)


def candidate():
    with connect(URL) as ws:
        print("Candidate connected")
        print("Candidate:", ws.recv())

        time.sleep(1)

        ws.send(
            json.dumps(
                {
                    "type": "code_update",
                    "question_id": 1,
                    "code": "print(2 + 3)",
                }
            )
        )

        print("Candidate sent code_update")


recruiter_thread = threading.Thread(target=recruiter)
candidate_thread = threading.Thread(target=candidate)

recruiter_thread.start()

time.sleep(0.5)

candidate_thread.start()

candidate_thread.join()
recruiter_thread.join()