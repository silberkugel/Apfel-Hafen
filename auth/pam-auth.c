#include <security/pam_appl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct credentials {
  const char *password;
};

static int conversation(int count, const struct pam_message **messages,
                        struct pam_response **responses, void *context) {
  struct credentials *credentials = context;
  struct pam_response *result = calloc((size_t)count, sizeof(struct pam_response));
  if (result == NULL) return PAM_BUF_ERR;

  for (int index = 0; index < count; index++) {
    switch (messages[index]->msg_style) {
      case PAM_PROMPT_ECHO_OFF:
        result[index].resp = strdup(credentials->password);
        break;
      case PAM_PROMPT_ECHO_ON:
        result[index].resp = strdup("");
        break;
      case PAM_ERROR_MSG:
      case PAM_TEXT_INFO:
        result[index].resp = NULL;
        break;
      default:
        free(result);
        return PAM_CONV_ERR;
    }
    if (messages[index]->msg_style <= PAM_PROMPT_ECHO_ON && result[index].resp == NULL) {
      free(result);
      return PAM_BUF_ERR;
    }
  }

  *responses = result;
  return PAM_SUCCESS;
}

int main(int argc, char **argv) {
  if (argc != 2) return 2;

  char password[1025] = {0};
  size_t length = fread(password, 1, sizeof(password) - 1, stdin);
  if (ferror(stdin) || length == 0) return 2;
  while (length > 0 && (password[length - 1] == '\n' || password[length - 1] == '\r')) {
    password[--length] = '\0';
  }

  struct credentials credentials = { .password = password };
  struct pam_conv pam_conversation = { .conv = conversation, .appdata_ptr = &credentials };
  pam_handle_t *handle = NULL;
  int status = pam_start("login", argv[1], &pam_conversation, &handle);
  if (status == PAM_SUCCESS) status = pam_authenticate(handle, PAM_SILENT);
  if (status == PAM_SUCCESS) status = pam_acct_mgmt(handle, PAM_SILENT);
  if (handle != NULL) pam_end(handle, status);

  memset(password, 0, sizeof(password));
  return status == PAM_SUCCESS ? 0 : 1;
}
