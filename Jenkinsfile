pipeline {
  agent any
  stages {
    stage('Build') {
      parallel {
        stage('Build Notification-service') {
          steps {
            sh '''cd notification-service
./gradlew build -x test'''
          }
        }
        stage('Build App-service') {
          steps {
            sh '''cd app-service
./gradlew build -x test
'''
          }
        }
        stage('Build Client-Core') {
          steps {
            sh '''cd client-core
./gradlew build -x test
'''
          }
        }
      }
    }
    stage('Test') {
      parallel {
        stage('Test Notification-service') {
          steps {
            sh '''cd notification-service
./gradlew test --continue'''
          }
          post {
            always {
              junit '**/notification-service/build/**/*.xml'
            }
          }
        }
        stage('Test App-service') {
          steps {
            sh '''cd app-service
./gradlew build test --continue
'''
          }
          post {
            always {
              junit '**/app-service/build/**/*.xml'
            }
          }
        }
        stage('Test Client-core') {
          steps {
            sh '''cd client-core

./gradlew build test --continue
'''
          }
          post {
            always {
              junit '**/client-core/build/**/*.xml'
            }
          }
        }
      }
    }
  }
}
